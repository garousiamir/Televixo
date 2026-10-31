# Visual comparison (reference vs implementation)

Method (`tests/visual/compare.mjs`): load `refrence-html/chio-contact.html` offline, open its chat, send "Which size am I?", wait for the demo reply and screenshot the panel. Then hide the reference panel, inject the built Televixo widget into **the same page** in preview mode with the same copy and avatar, and screenshot the Televixo panel. Crops are placed side by side with a pixelmatch diff (threshold 0.15). Run at 1440×900, 820×1180 and 390×844, LTR and RTL (RTL by setting `dir="rtl"` on the reference document).

The reference avatar photo is used only inside this local harness; it is not shipped (redistribution rights unknown).

| Size | Dir | Reference panel | Televixo panel | Pixel diff* |
|---|---|---|---|---|
| desktop | ltr | 380 × 446 @ x 1036 | 380 × 530 @ x 1036 | 9.8 % |
| desktop | rtl | 380 × 446 @ x 1036 | 380 × 530 @ x 24 | 10.1 % |
| tablet | ltr | 380 × 446 @ x 416 | 380 × 530 @ x 416 | 9.7 % |
| tablet | rtl | 380 × 446 @ x 416 | 380 × 530 @ x 24 | 9.8 % |
| mobile | ltr | 366 × 446 @ x 12 | 366 × 560 @ x 12 | 10.4 % |
| mobile | rtl | 366 × 446 @ x 12 | 366 × 560 @ x 12 | 10.2 % |

\*The diff is dominated by intentional content differences (timestamps and day separator shift every bubble down; the extra *more* button; composer tools; chips hidden after the visitor writes), so it is an indicator, not a pass/fail score.

Matching: panel width, radius, border and shadow; header colour, radius, padding, avatar, title/subtitle typography and green dot; glass close button; bubble font size, line height, padding, colours and tail corners; composer pill height, radius and Send button. In RTL, Televixo mirrors to the logical side (the reference stays physically right — it has no RTL design).

Images are generated in `docs/visual/compare-*.png` (left: reference, middle: Televixo, right: diff). They contain reference artwork and are therefore excluded from the distribution archive.

**Visual acceptance status:** compared and documented; final sign-off by the product owner is pending.
