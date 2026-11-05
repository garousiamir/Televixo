# Televixo promo videos

* `televixo-promo.mp4` — 60 s, 1920×1080 (16:9), 60 fps
* `televixo-promo-short.mp4` — 60 s, 1080×1920 (9:16) for YouTube Shorts, Reels and TikTok, same soundtrack and timing

Everything is generated from code in `video/` — no stock footage, samples or licensed music.

| File | Purpose |
|---|---|
| `video/timeline.json` | Shared timeline: 128 BPM, scene boundaries and sound-effect cues (32 bars = 60 s) |
| `video/audio.py` | Original soundtrack and sound effects synthesized with NumPy/SciPy → `build/soundtrack.wav` |
| `video/index.html` | Motion graphics; `render(t)` sets every element from the time value (deterministic) |
| `video/render.cjs` | Renders 3,600 frames in headless Chromium and encodes H.264 |
| `video/preview.cjs` | Renders chosen timestamps into a contact sheet for review |
| `video/make-vertical.py` | Generates `video/vertical.html` (9:16 layout) from `index.html` |
| `televixo-promo.mp4` | Final video (H.264 + AAC 256 kb/s) |
| `televixo-promo-poster.jpg` | Thumbnail |

## Rebuild

```bash
pip install numpy scipy && python3 video/audio.py
```

```bash
node video/render.cjs
```

```bash
ffmpeg -y -i video/build/video-only.mp4 -i video/build/soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart televixo-promo.mp4
```

Vertical version:

```bash
python3 video/make-vertical.py
```

```bash
PAGE=vertical.html W=1080 H=1920 OUT=video-only-vertical.mp4 node video/render.cjs
```

```bash
ffmpeg -y -i video/build/video-only-vertical.mp4 -i video/build/soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart televixo-promo-short.mp4
```

In the vertical layout, key content stays between roughly y 180 and 1500 and away from the right edge, clear of the Shorts title and button overlays.

Requires Playwright with Chromium, ffmpeg and the Noto Color Emoji font.

## Storyboard

| Time | Scene |
|---|---|
| 0–3.75 s | Hook: “Your visitors have *questions.* / Answer them from *Telegram.*” |
| 3.75–7.5 s | Drop: colour-ring burst, logo pill, “Televixo”, tagline |
| 7.5–22.5 s | Live demo on the Chio product page: launcher → visitor asks a size question → message flies to the team’s Telegram group → operator replies → answer appears on the site; captions |
| 22.5–26.25 s | Break: “One plugin. *Every conversation.* Under control.” |
| 26.25–48.75 s | Six features: Reply/Topics Mode, team inbox, targeting, honest availability, reports & CSAT, security & privacy |
| 48.75–52.5 s | Stat tiles: 22 KB widget, RTL/translation-ready, 5-minute setup, $0 monthly fees |
| 52.5–60 s | Outro: logo, tagline, “Get Televixo now” call to action, confetti finale |

## Rights notes

* Fonts: Hanken Grotesk and Instrument Serif (SIL OFL 1.1).
* The storefront screenshots come from the supplied Chio reference HTML, including its product photos. **Confirm you have the rights to those photos before publishing the video publicly.**
* The Telegram name is used descriptively; no Telegram logo is shown.
* “Sample data” is labelled on the reports scene.

## Pricing comparison video

* `televixo-pricing.mp4` — 45 s, 1920×1080 (16:9), 60 fps
* `televixo-pricing-short.mp4` — 45 s, 1080×1920 (9:16), same soundtrack and timing

Source in `pricing-video/` (shares fonts with `video/assets` via a symlink):

| File | Purpose |
|---|---|
| `pricing-video/timeline.json` | 128 BPM, 24 bars = 45 s; section types, table row times and SFX cues |
| `pricing-video/audio2.py` | Original soundtrack (D minor) + coin, counter, cash, strike and stamp SFX, all synthesized |
| `pricing-video/pricing.html` | Motion graphics; one page, the 9:16 layout comes from an `orientation: portrait` media query |
| `pricing-video/render.cjs`, `preview.cjs` | Same renderer and contact-sheet tool as the promo, defaulting to `pricing.html` |

```bash
python3 pricing-video/audio2.py
```

```bash
OUT=wide.mp4 node pricing-video/render.cjs
```

```bash
W=1080 H=1920 OUT=tall.mp4 node pricing-video/render.cjs
```

```bash
ffmpeg -y -i pricing-video/build/wide.mp4 -i pricing-video/build/soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart televixo-pricing.mp4
```

Storyboard: hook "Tired of paying every month for live chat tools?" → 12 month tiles stamped PAID (−$165 each, Zendesk Suite Team example) → "Per seat. Per month. Forever." → table of six tools revealed row by row with monthly and 3-year totals → "What if you paid once?" → competitor prices struck through, Televixo row "$0/mo · No subscription" + PAY ONCE stamp → "Your own phone / Telegram / website" with a phone notification → outro "Pay once. Chat forever."

**Price data** (entry paid plan, 3 agents, billed annually where offered, as published Nov 2026; collected from third-party pricing summaries because vendor sites were not reachable from the build environment): Tidio Starter $24.17/mo (100 conversations), Crisp Mini $45/mo per workspace (4 seats), LiveChat Starter $19/agent, Freshchat Growth $19/agent, Intercom Essential $29/seat + $0.99 per AI resolution, Zendesk Suite Team $55/agent. **Re-check every price on the vendor's own pricing page before running ads**, and update `ROWS` in `pricing.html` if anything changed. No Televixo price is shown on purpose — set it on your listing.
