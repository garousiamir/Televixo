/*
 * Chio product page — extra product content (-> product metafields in Shopify).
 * Loaded by sections/main-product.html after assets/chio/catalog.js. Nothing here changes the shared catalog for other
 * pages; `ChioPDP.enrich(product)` returns a copy with the page-only extras merged in.
 *
 *   ChioPDP.defaultHandle            product shown when the URL has no ?handle=
 *   ChioPDP.enrich(product)          -> { ...product, media[], banner, story{}, features[], careTags[], bullets[], sizeChart{} }
 *   ChioPDP.stock(variant)           -> units left (deterministic stand-in for inventory_quantity)
 *   ChioPDP.delivery(now)            -> { cutoff, from, to } estimated delivery window
 */
(function () {
  const P = 'assets/images/product/';
  const C = 'assets/images/chio/products/';

  /* Size charts by garment family (cm). Shown in the page's "Size & Fit" table and the size-guide modal. */
  const CHARTS = {
    top: { cols: ['Chest', 'Length', 'Sleeve'], rows: [
      { size: 'XS', v: [108, 66, 57] }, { size: 'S', v: [112, 68, 58] }, { size: 'M', v: [116, 70, 59] },
      { size: 'L', v: [120, 72, 60] }, { size: 'XL', v: [124, 74, 61] }, { size: 'XXL', v: [128, 76, 62] }] },
    dress: { cols: ['Bust', 'Waist', 'Length'], rows: [
      { size: 'XS', v: [80, 62, 84] }, { size: 'S', v: [84, 66, 85] }, { size: 'M', v: [88, 70, 86] },
      { size: 'L', v: [94, 76, 87] }, { size: 'XL', v: [100, 82, 88] }, { size: 'XXL', v: [106, 88, 89] }] },
    outer: { cols: ['Chest', 'Length', 'Sleeve'], rows: [
      { size: 'XS', v: [104, 58, 60] }, { size: 'S', v: [108, 60, 61] }, { size: 'M', v: [112, 62, 62] },
      { size: 'L', v: [118, 64, 63] }, { size: 'XL', v: [124, 66, 64] }, { size: 'XXL', v: [130, 68, 65] }] },
    pants: { cols: ['Waist', 'Hip', 'Inseam'], rows: [
      { size: 'XS', v: [62, 90, 76] }, { size: 'S', v: [66, 94, 77] }, { size: 'M', v: [70, 98, 78] },
      { size: 'L', v: [76, 104, 79] }, { size: 'XL', v: [82, 110, 80] }, { size: 'XXL', v: [88, 116, 81] }] },
    shoes: { unitless: true, cols: ['UK', 'US', 'Foot (cm)'], rows: [
      { size: '36', v: [3, 5.5, 23] }, { size: '37', v: [4, 6.5, 23.7] }, { size: '38', v: [5, 7.5, 24.3] },
      { size: '39', v: [6, 8.5, 25] }, { size: '40', v: [6.5, 9, 25.7] }, { size: '41', v: [7.5, 10, 26.3] }] },
  };
  const familyOf = (p) => {
    const t = (p.type || '').toLowerCase();
    if (t === 'boots' || p.collections.includes('shoes')) return 'shoes';
    if (t === 'bag') return null;
    if (t === 'dress') return 'dress';
    if (t === 'pants') return 'pants';
    if (t === 'jacket' || t === 'coat') return 'outer';
    return 'top';
  };

  /* Hand-written content for the client's hero product (product-page.html / Figma "Product Page"). */
  const EXTRA = {
    'oversized-graphic-sweatshirt': {
      media: [P + 'gallery-1.jpg', P + 'gallery-2.jpg', P + 'gallery-3.jpg', P + 'gallery-4.jpg', P + 'gallery-5.jpg',
        C + 'oversized-graphic-sweatshirt-1.jpg', C + 'oversized-graphic-sweatshirt-2.jpg', C + 'oversized-graphic-sweatshirt-3.jpg'],
      banner: { src: P + 'banner.jpg', alt: 'Model wearing the cobalt oversized sweatshirt, seated in a cream lounge chair' },
      lede: 'Designed for everyday comfort with a refined modern silhouette. Crafted from premium materials to deliver durability, warmth, and effortless style for every season.',
      story: {
        title: 'Made For Everyday Wear',
        text: ['The Essential Blue Oversized Sweatshirt combines a relaxed silhouette with a clean, contemporary aesthetic. Designed with a dropped shoulder, roomy sleeves, and a slightly relaxed body, it creates an effortless look without compromising on comfort.',
          'The minimal chest graphic adds a subtle signature detail, while the heavyweight construction gives the sweatshirt a structured feel and premium finish.'],
        title2: 'Built With Comfort In Mind',
        text2: 'Made from a premium cotton blend, this sweatshirt combines a soft hand feel with a durable heavyweight construction. The brushed interior provides additional comfort, while the outer surface maintains a clean and structured appearance.',
      },
      careTags: ['Machine Wash Cold', 'Wash With Similar Colors', 'Do Not Bleach', 'Do Not Tumble Dry'],
      features: [
        { title: 'Heavyweight Fabric', text: 'Premium 420 GSM construction.' },
        { title: 'Oversized Fit', text: 'Relaxed silhouette for effortless styling.' },
        { title: 'Soft Interior', text: 'Brushed inside for everyday comfort.' },
      ],
      bullets: ['oversized relaxed fit', 'dropped shoulder design', 'long relaxed sleeves', 'heavyweight construction', 'ribbed cuffs and hem', 'minimal chest graphic', 'designed for everyday wear'],
      model: 'Model is 175 cm / 5′9″ and wears size S',
    },
  };

  /* Generic content derived from the catalog fields for every other product */
  const CARE = {
    default: ['Machine Wash Cold', 'Wash Inside Out', 'Do Not Bleach', 'Do Not Tumble Dry'],
    knit: ['Hand Wash Cold', 'Dry Flat', 'Do Not Wring', 'Fold, Don’t Hang'],
    dry: ['Dry Clean Only', 'Steam To Refresh', 'Store On A Hanger'],
    suede: ['Brush To Clean', 'Protect Before Wear', 'Keep Away From Rain'],
    leather: ['Wipe With A Dry Cloth', 'Store In Dust Bag', 'Avoid Direct Sun'],
  };
  const careFor = (p) => {
    const t = p.tags.join(' ');
    if (/suede/.test(t)) return CARE.suede;
    if (p.type === 'Bag') return CARE.leather;
    if (/Dry clean/i.test(p.care || '')) return CARE.dry;
    if (/knit|cardigan|wool/.test(t + ' ' + p.type.toLowerCase())) return CARE.knit;
    return CARE.default;
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function enrich(p) {
    if (!p) return null;
    const x = EXTRA[p.handle] || {};
    const fam = familyOf(p);
    const details = p.details && p.details.length ? p.details : [p.fit, p.material].filter(Boolean);
    const features = x.features || [
      { title: 'Material', text: (p.material || '').split(',')[0] + '.' },
      { title: p.type === 'Bag' ? 'Dimensions' : 'The Fit', text: (p.fit || 'True to size') + '.' },
      p.details && p.details[0] ? { title: 'Detail', text: p.details[0] + '.' } : { title: 'Care', text: (p.care || '').split('.')[0] + '.' },
    ].filter(Boolean);
    return {
      ...p,
      media: x.media || p.images,
      banner: x.banner || null,                                   // wide editorial image; otherwise the page shows a lookbook strip
      lookbook: p.images.slice(0, 3),
      lede: x.lede || p.description,
      story: x.story || {
        title: 'Made For Everyday Wear',
        text: [p.description, `${p.material ? 'Made from ' + p.material.charAt(0).toLowerCase() + p.material.slice(1) + '. ' : ''}${p.fit ? 'Fit: ' + p.fit.charAt(0).toLowerCase() + p.fit.slice(1) + '.' : ''}`].filter(Boolean),
        title2: 'Built With Care In Mind',
        text2: `${p.care || ''} Every Chio piece is checked by hand before it leaves our studio, and comes with free returns within 30 days.`.trim(),
      },
      careTags: x.careTags || careFor(p),
      features,
      bullets: x.bullets || [...details.map((d) => d.charAt(0).toLowerCase() + d.slice(1)), p.fit && p.fit.toLowerCase(), 'designed for everyday wear'].filter(Boolean),
      model: x.model || (fam && fam !== 'shoes' ? 'Model is 175 cm / 5′9″ and wears size S' : ''),
      sizeChart: fam ? CHARTS[fam] : null,
      family: fam,
      collectionTitle: cap(p.type || ''),
    };
  }

  /* inventory stand-in: 0 for sold-out variants, otherwise 3–24 units (stable per variant) */
  const stock = (v) => (!v || !v.available ? 0 : 3 + ((v.id * 37) % 22));

  /* estimated delivery: order before 15:00 → dispatched today; standard delivery 2–4 business days */
  function addBusinessDays(d, n) { const r = new Date(d); while (n > 0) { r.setDate(r.getDate() + 1); if (r.getDay() !== 0 && r.getDay() !== 6) n--; } return r; }
  function delivery(now = new Date()) {
    const cutoff = new Date(now); cutoff.setHours(15, 0, 0, 0);
    let ship = new Date(now);
    if (now >= cutoff || now.getDay() === 0 || now.getDay() === 6) { ship = addBusinessDays(now, 1); cutoff.setTime(ship.getTime()); cutoff.setHours(15, 0, 0, 0); }
    return { cutoff, from: addBusinessDays(ship, 2), to: addBusinessDays(ship, 4) };
  }

  window.ChioPDP = { defaultHandle: 'oversized-graphic-sweatshirt', enrich, stock, delivery, charts: CHARTS };
})();
