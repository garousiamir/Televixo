# Marketplace kit — Televixo

Sizes follow CodeCanyon's long-standing WordPress item specs. The official spec page could not be fetched from the build environment, so **check the upload form for current requirements** before submitting.

| File | Use | Spec |
|---|---|---|
| `thumbnail-80x80.png` | Item thumbnail / icon | 80×80 PNG, 7 KB |
| `icon-512.png` | Master icon (transparent corners) — social, plugin header, favicon source | 512×512 PNG |
| `inline-preview-590x300.jpg` / `.png` | Inline preview (cover) | 590×300, JPG 49 KB |
| `inline-preview-1180x600.png` | Retina master of the cover | 1180×600 |
| `presentation/*.jpg` + `presentation.zip` | Item presentation images, in order | 8 × 1920×1080 JPG (PNG masters included) |
| `../landing/` + `landing.zip` | Landing page for the "Live Preview" link | static HTML, responsive, no external requests |
| `../televixo-promo.mp4` | Promo video (YouTube/Vimeo link for the item page) | 1920×1080, 60 fps, 60 s |
| `listing.md` | Title, tags, short and long description | — |

## Presentation order

1. Hero — "Your website chat, answered in Telegram."
2. How it works — three steps
3. Reply Mode or Topics
4. Team inbox in WordPress
5. Targeting & automation
6. Design & languages (RTL)
7. Reliability & security
8. Everything included + requirements

## Before publishing

* **Landing page:** set `BUY_URL` at the bottom of `landing/index.html` to your item URL (the buttons scroll to the final call to action until then). Upload the `landing/` folder to any static host.
* **Photos:** the storefront screenshot (product page with model photos) comes from the supplied Chio reference HTML. Confirm you have rights to show those photos publicly, or replace `site-product` images.
* **Trademarks:** the Telegram name is used descriptively; no Telegram logo is used. The landing footer states that Televixo is not affiliated with Telegram.
* **Rebuild:** `node ../marketplace-src/render.cjs` regenerates all graphics from `../marketplace-src/assets.html`.
