# Design system

## Source

The supplied reference (`refrence-html/`, a static "Chio" storefront built with Tailwind v4 browser build, Alpine.js and Swiper) contains **one** chat surface: the live chat panel of `chio-contact.html` (lines 538–566) plus the "Start chat" dark pill that opens it. It does **not** contain a floating launcher, teaser, pre-chat/offline forms, menus, uploads, ratings or any admin screen. Its scripts were inspected before execution: they contain demo data and `localStorage` state only — no network calls, analytics or tracking — and were rendered offline with CDN URLs mapped to pinned npm copies (`tests/visual/compare.mjs`).

## Tokens extracted (computed styles at 1440×900)

| Token | Value | Reference origin |
|---|---|---|
| Font stack | `"Helvetica Now Display", "Hanken Grotesk", system-ui` | `@theme --font-sans` |
| Tracking | `-0.016em` | `:root --fx` |
| Ink / dark | `#000` / `#1c1c1c` | header + own bubble |
| Chip surface | `#f6f6f6` | `--color-chip`, operator bubble |
| Lines | `#eee` (panel/field), `#e0e0e0` (chips) | `.field`, `.chip` |
| Muted on dark | `#a0a0a0` | header subtitle |
| Online dot | `#4ade80`, 6 px | header |
| Panel | 380 px wide, radius 24, border `#eee`, shadow `0 32px 64px -24px rgba(0,0,0,.35)`, `max-height: min(560px, 100vh − 140px)` | dialog classes |
| Header | padding 16/20, bottom radius 24, avatar 40 px, title 16/500, subtitle 12 | header classes |
| Glass button | 40×40, radius 10, `rgba(0,0,0,.08)` + `1px rgba(255,255,255,.16)`, blur 12 | `.glass` |
| Log | padding 20/16, gap 12 | `ol` classes |
| Bubble | 14 px / 20.6 px, padding 12/16, radius 16 with 6 px tail corner, max-width 80 % | `li span` classes |
| Typing | three 6 px `#b5b5b5` dots, bounce, 0.15 s stagger | typing `li` |
| Chip | 32 px high, radius 8, 10 px padding, 12 px uppercase | `.chip` |
| Composer | 48 px pill, radius 32, margin 12 (0 top), focus border change | `.field` |
| Primary button | gradient `#333→#111`, 1 px black border, inset shadows, 32 px pill, 12/500 | `.btn-dark` |
| Motion | panel opacity 200 ms; hover brightness 1.25; press translateY(1px) | `x-transition`, `.btn-dark` |
| Breakpoints | `sm` 640 px (panel 380 px at right 24), `lg` 1024 px (bottom 24; below: bottom 96 above a mobile nav) | panel classes |

`Helvetica Now Display` is commercial and **not bundled**; the reference itself names Hanken Grotesk as the free fallback. Televixo bundles Hanken Grotesk 400/500 (latin, latin-ext) and Vazirmatn 400/500 (Arabic script, for Persian), both SIL OFL 1.1, served locally with `unicode-range` so only needed files download.

## Extensions (new design decisions, not in the reference)

| Surface | Decision |
|---|---|
| Floating launcher | Reuses the reference "Start chat" pill: `.btn-dark` gradient pill with label and an `.arr`-style inset circle holding the icon. Circle variant = same gradient. Online dot uses the reference green; unread badge uses the reference pink `#e0385d`. |
| Teaser / greeting bubble | Operator-bubble shape (radius 16, 6 px tail toward the launcher) on white with the panel shadow. |
| Header actions | Reference has only *close*. Televixo adds one *more options* glass button (sound, help, expand, transcript, end chat, report). |
| Composer tools | Attach, emoji and microphone as 32 px muted icon buttons inside the pill; *Send* keeps the reference pill. |
| Timestamps, day separators, delivery state | 11 px muted meta line under the last bubble of a group; day pill on `#fafafa`. Required by the product spec; absent in the reference. |
| Forms (pre-chat, offline, rating) | Reference `.input` (radius 16, 44–48 px) and `.check`; labels 12 px uppercase like reference eyebrow text. |
| Admin | Same language: white cards with radius 24, `#1c1c1c` thread header with 24 px bottom radius, glossy dark primary pills, white ghost pills, uppercase 12 px tabs styled as reference chips. |
| RTL | Logical properties: bubbles, tails and the launcher side mirror (`end` = left in RTL). The reference uses physical `right-6`/`rounded-br`, i.e. it was not designed for RTL. |
| Expanded / full screen | Desktop expanded panel 560 × 760; on ≤ 640 px expanded becomes full screen with modal semantics and focus trap. |

## Intentional deviations

| Deviation | Reason |
|---|---|
| Chip text, placeholder and meta text `#6f6f6f` instead of `#b5b5b5` | Accessibility: `#b5b5b5` on white is 2.0:1; `#6f6f6f` is 5.0:1 (WCAG 1.4.3). |
| Composer focus border `#767676` instead of `#a3a3a3` | Focus indicator contrast ≥ 3:1. |
| Touch targets 40–44 px on coarse pointers | WCAG 2.5.8 / mobile usability; reference uses 32 px Send and 40 px close. |
| Suggestion chips hidden after the visitor writes | Behavioural: chips are conversation starters; the reference demo keeps them visible. |
| Panel sits above the launcher | The reference panel replaces a page button; a floating widget needs the launcher to remain. |
| Panel height grows with content up to the reference max (min 320 px) | Same rule as the reference (`max-h`), with a minimum for forms. |

## Visual comparison

See `visual-comparison.md`.
