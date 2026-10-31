"""Original soundtrack + sound effects for the Televixo promo.

Everything is synthesized here (no samples, no third-party audio), so the
result is royalty-free. 128 BPM, A minor, Am–F–C–G, 32 bars = 60 s.

    python3 audio.py  ->  build/soundtrack.wav (48 kHz stereo)
"""
import json
import os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
BPM = TL['bpm']
BEAT = 60.0 / BPM
BAR = 4 * BEAT
DUR = TL['duration']
N = int(SR * (DUR + 0.0))
rng = np.random.default_rng(7)

def buf():
    return np.zeros((N, 2))

def add(bus, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * gain

def env(n, a=0.002, d=0.2, s=0.0, r=0.0, hold=0.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    dec = np.exp(-(t - a - hold).clip(0) / max(d, 1e-6))
    e = e * (s + (1 - s) * dec)
    if r > 0:
        rel = np.clip((n / SR - t) / r, 0, 1)
        e = e * rel
    return e

def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100) / (SR / 2), 'low', output='sos'), x, axis=0)

def hp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), 'high', output='sos'), x, axis=0)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], 'band', output='sos'), x, axis=0)

def sweep_lp(x, f0, f1, block=512):
    """Low-pass whose cutoff moves exponentially from f0 to f1."""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(1, nb - 1))
        sos = butter(2, min(f, SR / 2 - 200) / (SR / 2), 'low', output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        seg = x[b * block:(b + 1) * block]
        y, zi = sosfilt(sos, seg, axis=0, zi=zi)
        out[b * block:(b + 1) * block] = y
    return out

def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((t * freq + phase) % 1.0) - 1

def noise(n):
    return rng.uniform(-1, 1, n)

def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------- instruments
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.28)
    click = hp(noise(n), 3000) * np.exp(-t / 0.004) * 0.4
    return np.tanh(1.6 * (body + click)) * 0.95

def clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    x = bp(noise(n), 900, 4200)
    e = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022, 0.033]):
        e += np.exp(-(t - o).clip(0) / (0.008 if k < 3 else 0.12)) * (t >= o)
    return x * e * 0.55

def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    return hp(noise(n), 8000, 4) * np.exp(-t / (0.09 if open_ else 0.018)) * 0.35

def supersaw(freqs, n, cutoff, voices=5, detune=0.012, stereo=True):
    l = np.zeros(n)
    r = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) * detune / (voices - 1) * 2
            s = saw(f * (1 + d), n, phase=rng.random())
            if v % 2:
                l += s * 0.8
                r += s * 1.0
            else:
                l += s * 1.0
                r += s * 0.8
    st = np.stack([l, r], axis=1) / (len(freqs) * voices)
    return lp(st, cutoff, 2)

def pluck(freq, n, bright=4000):
    t = np.arange(n) / SR
    s = 0.6 * saw(freq, n) + 0.4 * np.sign(np.sin(2 * np.pi * freq * t))
    return lp(s * np.exp(-t / 0.18), bright) * 0.6

def riser(dur, f0=300, f1=9000):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n)[:, None].repeat(2, 1)
    x = sweep_lp(x, f0, f1)
    tone = np.sin(2 * np.pi * np.cumsum(220 * (4 ** (t / dur))) / SR)
    shape = (t / dur) ** 2
    return (x * 0.6 + tone[:, None] * 0.12) * shape[:, None]

def impact():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crash = hp(noise(n), 2500) * np.exp(-t / 0.9) * 0.35
    return np.tanh(1.4 * (boom + crash)) * 0.9

def reverb(x, seconds=2.2, mix=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir_l = noise(n) * np.exp(-t / (seconds / 5))
    ir_r = noise(n) * np.exp(-t / (seconds / 5))
    ir_l = lp(ir_l, 6000)
    ir_r = lp(ir_r, 6000)
    wet = np.stack([fftconvolve(x[:, 0], ir_l)[: len(x)], fftconvolve(x[:, 1], ir_r)[: len(x)]], axis=1)
    wet /= np.max(np.abs(wet)) + 1e-9
    wet *= np.max(np.abs(x)) + 1e-9
    return x + wet * mix

# ------------------------------------------------------------- arrangement
S = TL['sections']
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G (A3..)
ROOTS = [33, 29, 36, 31]  # A1 F1 C2 G1

drums, bass, chords, lead, fx = buf(), buf(), buf(), buf(), buf()
side = np.ones(N)  # sidechain gain driven by kicks

def in_(sec, t):
    a, b = S[sec]
    return a <= t < b

K = kick()
kick_times = []
for i in range(int(DUR / BEAT)):
    t = i * BEAT
    full = in_('logo', t) or in_('features', t) or in_('outro', t) and t < 56.25
    groove = in_('demo', t)
    build = in_('stats', t)
    if full or groove or build:
        if not (in_('demo', t) and 18.75 <= t < 22.5 and i % 2):  # thin out at the end of the demo
            add(drums, K, t, 0.9)
            kick_times.append(t)
    if (full or groove) and i % 4 in (1, 3):
        add(drums, clap(), t, 0.7, 0.05)
    if full or groove:
        add(drums, hat(), t + BEAT / 2, 0.6 if full else 0.45, 0.25)
        add(drums, hat(), t + BEAT / 4 * 3, 0.25, -0.2)
        if full and i % 2:
            add(drums, hat(True), t + BEAT / 2, 0.35, 0.3)
    if build:  # 16th snare roll rising into the outro
        for k in range(4):
            tt = t + k * BEAT / 4
            add(drums, clap() * 0.6, tt, 0.25 + 0.6 * (tt - S['stats'][0]) / (S['stats'][1] - S['stats'][0]))
# break snare roll
a, b = S['break']
steps = int((b - a - BEAT) / (BEAT / 4))
for k in range(steps):
    tt = a + BEAT * 0 + k * (BEAT / 4) * (1 if k < steps / 2 else 0.5) if False else a + k * (BEAT / 4)
    if tt > b - BEAT / 2:
        break
    add(drums, clap(), tt, 0.1 + 0.55 * (k / steps) ** 2)

for kt in kick_times:
    i = int(kt * SR)
    n = int(0.32 * SR)
    j = min(N, i + n)
    curve = 0.35 + 0.65 * (1 - np.exp(-np.arange(j - i) / SR / 0.09))
    side[i:j] = np.minimum(side[i:j], curve)

# bass: offbeat rolling eighths
for bar in range(32):
    t0 = bar * BAR
    if t0 < S['logo'][0] or (S['break'][0] <= t0 < S['break'][1]) or t0 >= 56.25:
        continue
    root = ROOTS[bar % 4]
    for e in range(8):
        tt = t0 + e * BEAT / 2
        n = int(BEAT / 2 * SR * 0.92)
        note = root + (12 if e % 2 else 0)
        s = 0.7 * saw(midi(note), n) + 0.3 * np.sin(2 * np.pi * midi(note - 12) * np.arange(n) / SR)
        s = lp(s * env(n, 0.003, 0.12, 0.4, 0.02), 650 if not in_('demo', tt) else 480)
        add(bass, s, tt, 0.5)

# chords: pad in intro/break, stabs in drops
for bar in range(32):
    t0 = bar * BAR
    ch = [midi(m) for m in CHORDS[bar % 4]]
    if in_('hook', t0) or in_('break', t0):
        n = int(BAR * SR)
        pad = supersaw(ch + [ch[0] * 2], n, 1400 if in_('hook', t0) else 2200, voices=7)
        pad *= env(n, 0.25, 9, 0.9, 0.3)[:, None]
        add(chords, pad, t0, 0.55)
    elif t0 < 56.25:
        hard = in_('logo', t0) or in_('features', t0) or in_('outro', t0)
        pattern = [0, 0.75, 1.5, 2.5, 3.25] if hard else [0, 1.5, 2.5]
        for p in pattern:
            n = int(0.4 * SR)
            st = supersaw(ch + [ch[1] * 2], n, 5200 if hard else 2600, voices=5)
            st *= env(n, 0.003, 0.14, 0.15, 0.05)[:, None]
            add(chords, st, t0 + p * BEAT, 0.5 if hard else 0.32)

# lead hook (A minor pentatonic), drops only
HOOK = [(0, 76), (0.5, 79), (1, 81), (1.75, 79), (2.5, 76), (3, 74),
        (4, 72), (4.5, 74), (5, 76), (5.75, 74), (6.5, 72), (7, 69)]
for start in [S['logo'][0], S['features'][0], S['features'][0] + 2 * BAR * 2, S['features'][0] + 4 * BAR * 2, S['outro'][0]]:
    for rep in range(1 if start in (S['logo'][0], S['outro'][0]) else 1):
        for beat, m in HOOK:
            tt = start + beat * BEAT
            if tt >= 56.25:
                continue
            n = int(BEAT * 0.9 * SR)
            add(lead, pluck(midi(m), n), tt, 0.32, 0.0)
# light arpeggio in the demo groove
for bar in range(int(S['demo'][0] / BAR), int(S['demo'][1] / BAR)):
    ch = CHORDS[bar % 4]
    for k in range(8):
        tt = bar * BAR + k * BEAT / 2
        m = ch[k % 3] + 12 + (12 if k in (3, 7) else 0)
        n = int(BEAT / 2 * SR)
        add(lead, pluck(midi(m), n, 2600), tt, 0.13, -0.3 if k % 2 else 0.3)

# risers & impacts
add(fx, riser(S['logo'][0] - 0.2), 0.2, 0.55)
add(fx, riser(S['break'][1] - S['break'][0] - 0.1, 200, 12000), S['break'][0], 0.7)
add(fx, riser(S['stats'][1] - S['stats'][0], 400, 12000), S['stats'][0], 0.5)
add(fx, riser(BAR, 300, 8000), 18.75 + BAR, 0.35)

# ------------------------------------------------------------- sound effects
def sfx(kind, dur=0.0):
    if kind == 'tick':
        n = int(0.05 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.008) * 0.35
    if kind == 'click':
        n = int(0.06 * SR); t = np.arange(n) / SR
        return (hp(noise(n), 2000) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 1500 * t) * np.exp(-t / 0.01)) * 0.5
    if kind == 'pop':
        n = int(0.18 * SR); t = np.arange(n) / SR
        f = 380 + 900 * (1 - np.exp(-t / 0.03))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * 0.6
    if kind in ('whoosh', 'swoosh', 'fly'):
        d = {'whoosh': 0.7, 'swoosh': 0.45, 'fly': 0.75}[kind]
        n = int(d * SR); t = np.arange(n) / SR
        x = sweep_lp(noise(n)[:, None].repeat(2, 1), 400, 7000 if kind != 'fly' else 9000)
        shape = np.sin(np.pi * t / d) ** 2
        st = x * shape[:, None] * 0.7
        pan = np.linspace(-0.8, 0.8, n) if kind == 'fly' else np.zeros(n)
        st[:, 0] *= (1 - pan) / 1.0
        st[:, 1] *= (1 + pan) / 1.0
        return st
    if kind == 'send':
        n = int(0.22 * SR); t = np.arange(n) / SR
        f = 600 * 2 ** (t / 0.1)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06) * 0.4
    if kind in ('ping', 'ping2'):
        n = int(1.2 * SR); t = np.arange(n) / SR
        base = 1318.5 if kind == 'ping' else 1568.0
        s = sum(a * np.sin(2 * np.pi * base * m * t) * np.exp(-t / (0.5 / m)) for m, a in [(1, 1), (2.0, 0.35), (3.01, 0.15)])
        s2 = sum(a * np.sin(2 * np.pi * base * 1.5 * m * t) * np.exp(-t / (0.4 / m)) for m, a in [(1, 0.6), (2.0, 0.2)])
        delay = int(0.09 * SR)
        s = s + np.concatenate([np.zeros(delay), s2[:-delay]])
        return s * 0.28
    if kind == 'type':
        n = int(dur * SR); out = np.zeros(n)
        tt = 0.0
        while tt < dur - 0.05:
            k = sfx('click')[: int(0.03 * SR)] * (0.4 + 0.3 * rng.random())
            i = int(tt * SR); out[i:i + len(k)] += k[: n - i]
            tt += 0.07 + 0.06 * rng.random()
        return out * 0.6
    if kind == 'hit':
        n = int(0.6 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.2) + hp(noise(n), 4000) * np.exp(-t / 0.05) * 0.3) * 0.6
    if kind == 'lock':
        a = sfx('click'); b = sfx('pop')
        out = np.zeros(int(0.3 * SR)); out[: len(a)] += a; out[int(0.08 * SR): int(0.08 * SR) + len(b)] += b * 0.6
        return out
    if kind == 'impact':
        return impact()
    if kind == 'finale':
        n = int(3.75 * SR); out = impact()
        return np.concatenate([out, np.zeros(max(0, n - len(out)))])
    return np.zeros(1)

sfx_bus = buf()
for ev in TL['sfx']:
    s = sfx(ev['type'], ev.get('dur', 0))
    gain = {'impact': 0.9, 'finale': 1.0, 'hit': 0.55, 'tick': 0.6}.get(ev['type'], 0.8)
    pan = {'fly': 0.0, 'ping': 0.35, 'ping2': -0.35}.get(ev['type'], 0.0)
    add(sfx_bus, s, ev['t'], gain, pan if s.ndim == 1 else 0.0)

# final chord swell under the finale
t0 = 56.25
n = int((DUR - t0) * SR)
pad = supersaw([midi(m) for m in [57, 60, 64, 69, 76]], n, 3000, voices=7)
pad *= (env(n, 0.01, 1.4, 0.0) * np.clip((DUR - t0 - np.arange(n) / SR) / 1.0, 0, 1))[:, None]
add(chords, pad, t0, 0.6)

# ------------------------------------------------------------- mix
music = drums * 0.95 + (bass * side[:, None]) * 1.0 + (chords * side[:, None]) * 0.9 + lead * 0.9 + fx * 0.8
music = reverb(music, 2.0, 0.18)
music = hp(music, 28)
mix = music * 0.9 + reverb(sfx_bus, 1.2, 0.12) * 0.95
mix = np.tanh(mix * 1.15)
fade = np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1)
mix *= fade[:, None]
mix *= 10 ** (-1 / 20) / (np.max(np.abs(mix)) + 1e-9)

os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
wavfile.write(os.path.join(HERE, 'build', 'soundtrack.wav'), SR, (mix * 32767).astype(np.int16))
print('wrote build/soundtrack.wav', N / SR, 's')
