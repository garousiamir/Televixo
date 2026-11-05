"""Original soundtrack + sound effects for the Televixo pricing video.

Fully synthesized (no samples, no third-party audio), royalty-free.
128 BPM, D minor, Dm-Bb-F-C, 24 bars = 45 s. Sections and SFX cues come
from timeline.json.

    python3 audio2.py  ->  build/soundtrack.wav (48 kHz stereo)
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
rng = np.random.default_rng(11)

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
ARR = TL['arrangement']

def kind(t):
    for a, b, k in ARR:
        if a <= t < b:
            return k
    return 'end'

CHORDS = [[57, 62, 65], [58, 62, 65], [57, 60, 65], [55, 60, 64]]  # Dm Bb F C
ROOTS = [38, 34, 29, 36]
BARS = int(round(DUR / BAR))
END = [a for a, b, k in ARR if k == 'end'][0]

drums, bass, chords, lead, fx = buf(), buf(), buf(), buf(), buf()
side = np.ones(N)
K = kick()
kick_times = []
for i in range(int(DUR / BEAT)):
    t = i * BEAT
    k = kind(t)
    if k in ('groove', 'drop'):
        add(drums, K, t, 0.9); kick_times.append(t)
        if i % 4 in (1, 3):
            add(drums, clap(), t, 0.7 if k == 'drop' else 0.55, 0.05)
        add(drums, hat(), t + BEAT / 2, 0.6 if k == 'drop' else 0.42, 0.25)
        add(drums, hat(), t + BEAT * 0.75, 0.22, -0.2)
        if k == 'drop' and i % 2:
            add(drums, hat(True), t + BEAT / 2, 0.33, 0.3)
    if k == 'intro' and i % 2 == 0 and t > 0.1:
        add(drums, K * 0.5, t, 0.35)  # soft heartbeat
# snare roll in the break
a, b = [(a, b) for a, b, k in ARR if k == 'break'][0]
steps = int((b - a) / (BEAT / 4))
for s_ in range(steps):
    tt = a + s_ * BEAT / 4
    if tt > b - BEAT / 2:
        break
    add(drums, clap(), tt, 0.08 + 0.6 * (s_ / steps) ** 2)

for kt in kick_times:
    i = int(kt * SR); j = min(N, i + int(0.32 * SR))
    side[i:j] = np.minimum(side[i:j], 0.35 + 0.65 * (1 - np.exp(-np.arange(j - i) / SR / 0.09)))

for bar in range(BARS):
    t0 = bar * BAR
    k = kind(t0)
    ch = [midi(m) for m in CHORDS[bar % 4]]
    root = ROOTS[bar % 4]
    if k in ('groove', 'drop'):
        for e in range(8):
            tt = t0 + e * BEAT / 2
            n = int(BEAT / 2 * SR * 0.92)
            note = root - 12 + (12 if e % 2 else 0)
            s = 0.7 * saw(midi(note), n) + 0.3 * np.sin(2 * np.pi * midi(note - 12) * np.arange(n) / SR)
            add(bass, lp(s * env(n, 0.003, 0.12, 0.4, 0.02), 700 if k == 'drop' else 480), tt, 0.5)
        pattern = [0, 0.75, 1.5, 2.5, 3.25] if k == 'drop' else [0, 1.5, 2.5]
        for p in pattern:
            n = int(0.4 * SR)
            st = supersaw(ch + [ch[1] * 2], n, 5200 if k == 'drop' else 2400, voices=5)
            add(chords, st * env(n, 0.003, 0.14, 0.15, 0.05)[:, None], t0 + p * BEAT, 0.5 if k == 'drop' else 0.3)
    elif k in ('intro', 'break'):
        n = int(BAR * SR)
        pad = supersaw(ch + [ch[0] * 2], n, 1200 if k == 'intro' else 2200, voices=7)
        add(chords, pad * env(n, 0.25, 9, 0.9, 0.3)[:, None], t0, 0.55)
    # groove arpeggio (the "meter running" motif)
    if k == 'groove':
        for e in range(8):
            tt = t0 + e * BEAT / 2
            m = CHORDS[bar % 4][e % 3] + 12 + (12 if e in (3, 7) else 0)
            add(lead, pluck(midi(m), int(BEAT / 2 * SR), 2600), tt, 0.12, -0.3 if e % 2 else 0.3)

# uplifting lead hook in the drop (D minor -> F major colour)
HOOK = [(0, 74), (0.5, 77), (1, 81), (1.75, 79), (2.5, 77), (3, 76),
        (4, 77), (4.5, 76), (5, 72), (5.75, 74), (6.5, 76), (7, 77)]
drop0 = [a for a, b, k in ARR if k == 'drop'][0]
for start in [drop0, drop0 + 2 * BAR, drop0 + 4 * BAR]:
    for beat, m in HOOK:
        tt = start + beat * BEAT
        if tt < END:
            add(lead, pluck(midi(m), int(BEAT * 0.9 * SR)), tt, 0.32)

add(fx, riser(3.75 - 0.3, 250, 7000), 0.3, 0.45)
add(fx, riser(b - a - 0.1, 200, 12000), a, 0.7)
add(fx, riser(BAR, 300, 8000), 26.25 - BAR, 0.3)

# ------------------------------------------------------------- sound effects
def bell(f, d=0.9, partials=((1, 1), (2.76, 0.4), (5.4, 0.2), (8.9, 0.1))):
    n = int(d * SR); t = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d / (2 + m))) for m, a in partials)

def sfx(kind_, dur=0.0):
    if kind_ == 'tick':
        n = int(0.05 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.008) * 0.35
    if kind_ == 'click':
        n = int(0.06 * SR); t = np.arange(n) / SR
        return (hp(noise(n), 2000) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 1500 * t) * np.exp(-t / 0.01)) * 0.5
    if kind_ == 'pop':
        n = int(0.18 * SR); t = np.arange(n) / SR
        f = 380 + 900 * (1 - np.exp(-t / 0.03))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * 0.6
    if kind_ in ('whoosh', 'swoosh', 'strike'):
        d = {'whoosh': 0.7, 'swoosh': 0.45, 'strike': 0.22}[kind_]
        n = int(d * SR); t = np.arange(n) / SR
        x = sweep_lp(noise(n)[:, None].repeat(2, 1), 600 if kind_ == 'strike' else 400, 9000 if kind_ == 'strike' else 7000)
        shape = np.sin(np.pi * t / d) ** (1 if kind_ == 'strike' else 2)
        st = x * shape[:, None] * (0.9 if kind_ == 'strike' else 0.7)
        if kind_ == 'strike':
            pan = np.linspace(-0.7, 0.7, n)
            st[:, 0] *= 1 - pan; st[:, 1] *= 1 + pan
            c = sfx('click'); st[: len(c)] += c[:, None] * 0.5
        return st
    if kind_ == 'coin':
        # bright metallic "cha" - two quick bell partials stepping down
        n = int(0.5 * SR); out = np.zeros(n)
        a = bell(2637, 0.45); b = bell(1975.5, 0.45)
        out[: len(a)] += a[:n]
        j = int(0.06 * SR); out[j:j + len(b)] += b[: n - j] * 0.8
        out += hp(noise(n), 6000) * np.exp(-np.arange(n) / SR / 0.01) * 0.3
        return out * 0.22
    if kind_ == 'count':
        n = int(dur * SR); out = np.zeros(n); tt = 0.0; step = 0.035
        while tt < dur - 0.02:
            nn = int(0.025 * SR); t = np.arange(nn) / SR
            f = 1800 + 1400 * tt / dur
            c = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.005)
            i = int(tt * SR); out[i:i + nn] += c[: n - i]
            tt += step
        e = bell(1318.5, 0.6) * 0.5
        i = n - int(0.02 * SR)
        res = np.zeros(n + len(e)); res[:n] = out * 0.25; res[i:i + len(e)] += e
        return res * 0.8
    if kind_ == 'cash':
        n = int(1.6 * SR); out = np.zeros(n)
        for k, o in enumerate([0, 0.05, 0.1, 0.16]):
            c = sfx('coin'); i = int(o * SR); out[i:i + len(c)] += c[: n - i] * (1 - k * 0.12)
        bl = bell(2093, 1.3) * 0.35; i = int(0.2 * SR); out[i:i + len(bl)] += bl[: n - i]
        dr = sfx('hit')[: n]; out[: len(dr)] += dr * 0.5
        return out
    if kind_ == 'stamp':
        n = int(0.9 * SR); t = np.arange(n) / SR
        thud = np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.15)
        slap = bp(noise(n), 300, 2500) * np.exp(-t / 0.03) * 0.7
        return np.tanh(2.0 * (thud + slap)) * 0.75
    if kind_ == 'ping':
        n = int(1.2 * SR); t = np.arange(n) / SR
        base = 1318.5
        s = sum(a * np.sin(2 * np.pi * base * m * t) * np.exp(-t / (0.5 / m)) for m, a in [(1, 1), (2.0, 0.35), (3.01, 0.15)])
        s2 = sum(a * np.sin(2 * np.pi * base * 1.5 * m * t) * np.exp(-t / (0.4 / m)) for m, a in [(1, 0.6), (2.0, 0.2)])
        d_ = int(0.09 * SR)
        return (s + np.concatenate([np.zeros(d_), s2[:-d_]])) * 0.28
    if kind_ == 'hit':
        n = int(0.6 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.2) + hp(noise(n), 4000) * np.exp(-t / 0.05) * 0.3) * 0.6
    if kind_ == 'impact':
        return impact()
    if kind_ == 'finale':
        return impact()
    return np.zeros(1)

sfx_bus = buf()
for ev in TL['sfx']:
    s = sfx(ev['type'], ev.get('dur', 0))
    gain = {'impact': 0.9, 'finale': 1.0, 'hit': 0.6, 'tick': 0.6, 'coin': 0.9, 'strike': 0.55, 'stamp': 0.9}.get(ev['type'], 0.8)
    add(sfx_bus, s, ev['t'], gain, 0.3 if ev['type'] == 'ping' else 0.0)

n = int((DUR - END) * SR)
pad = supersaw([midi(m) for m in [53, 57, 60, 65, 69, 72]], n, 3200, voices=7)  # F major finale
pad *= (env(n, 0.01, 1.2, 0.0) * np.clip((DUR - END - np.arange(n) / SR) / 0.8, 0, 1))[:, None]
add(chords, pad, END, 0.6)

music = drums * 0.95 + bass * side[:, None] + chords * side[:, None] * 0.9 + lead * 0.9 + fx * 0.8
music = hp(reverb(music, 2.0, 0.18), 28)
mix = np.tanh((music * 0.88 + reverb(sfx_bus, 1.2, 0.12) * 1.0) * 1.15)
mix *= np.clip((DUR - np.arange(N) / SR) / 1.0, 0, 1)[:, None]
mix *= 10 ** (-1 / 20) / (np.max(np.abs(mix)) + 1e-9)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
wavfile.write(os.path.join(HERE, 'build', 'soundtrack.wav'), SR, (mix * 32767).astype(np.int16))
print('wrote build/soundtrack.wav', N / SR, 's')
