/*
 * Ween PDP extras — content that would live in product metafields / metaobjects in Shopify:
 *   story (two editorial blocks), feature cards, fabric composition, care symbols, fit notes, model info,
 *   and the size charts used by the "Size & fit" section and the size-guide modal.
 * WeenPdp.extra(product) -> merged content for the product's type (falls back to DEFAULT).
 */
(function () {
  const DEFAULT = {
    story: [
      { title: 'Made To Be Seen', text: 'Every piece starts as a hand sketch in our studio and goes through at least three fittings on real bodies before it is cut. French-style floral lace, finished edges and hardware that disappears — the details you notice up close are the reason it feels special on day one and on day one hundred.' },
      { title: 'Comfort, Built In', text: 'Lace with a hint of stretch moves with you, soft elastic lines every edge that touches skin, and nickel-free hardware is kind to sensitive skin. Nothing scratches, nothing digs — so you will actually reach for it.' },
    ],
    features: [
      { title: 'Soft-touch lace', text: 'Stretch lace with a silky hand-feel' },
      { title: 'Adjustable fit', text: 'Straps and hooks for a custom fit' },
      { title: 'Nickel-free', text: 'Hardware kind to sensitive skin' },
    ],
    fabric: [['Lace', '86% nylon, 14% elastane'], ['Lining', '100% cotton gusset'], ['Hardware', 'Nickel-free alloy']],
    care: ['Hand wash cold', 'Wash in a mesh bag', 'Do not bleach', 'Do not tumble dry', 'Lay flat to dry'],
    fit: ['Fits true to size — between sizes, size up for comfort.', 'Stretch lace gives about 2 cm of ease.', 'Model is 175 cm and wears a size S.'],
    model: 'Model is 175 cm · 34B · wears S',
  };

  const BY_TYPE = {
    'Garter Belt': {
      features: [
        { title: 'Four suspenders', text: 'Adjustable 18–27 cm, metal clips' },
        { title: 'Stays in place', text: 'Wide band lined with soft elastic' },
        { title: 'Detachable straps', text: 'Wear the belt on its own' },
      ],
      fit: ['Sits at the natural waist; fits true to size.', 'Between sizes or long torso (178 cm +), size up for extra strap length.', 'Model is 175 cm and wears a size S.'],
    },
    Bra: {
      features: [
        { title: 'Light support', text: 'Lightly lined cups, soft underband' },
        { title: 'Adjustable straps', text: 'Slide adjusters, stay put all day' },
        { title: '3-row hook & eye', text: 'Room to tighten as the band relaxes' },
      ],
      fabric: [['Lace', '86% nylon, 14% elastane'], ['Cup lining', '100% recycled polyester mesh'], ['Hardware', 'Nickel-free alloy']],
      fit: ['Fit the band on the loosest hook — it relaxes with wear.', 'Cups wrinkle? Go down a cup. Wire on breast tissue? Go up a cup.', 'Sister sizes share cup volume: 32C ↔ 34B ↔ 36A.'],
      model: 'Model is 175 cm · 34B · wears 34B',
    },
    Babydoll: {
      features: [
        { title: 'Sheer mesh', text: 'Feather-light, fluted rose-lace hem' },
        { title: 'Boned cups', text: 'Lift and shape without wire' },
        { title: 'Matching thong', text: 'Cotton gusset for comfort' },
      ],
      fit: ['Relaxed through the body; choose by bust size.', 'Between sizes? Size down for a closer fit at the cups.', 'Model is 175 cm and wears a size S.'],
    },
    Panty: {
      features: [
        { title: 'Cotton gusset', text: 'Breathable, comfortable all day' },
        { title: 'No visible lines', text: 'Flat, scalloped edges' },
        { title: 'Satin bow', text: 'Hand-tied front detail' },
      ],
      fit: ['Mid-rise with a cheeky back; fits true to size.', 'Between sizes? Size up for comfort at the hips.', 'Model is 175 cm and wears a size S.'],
    },
    Bodysuit: {
      features: [
        { title: 'Snap gusset', text: 'Three snaps for easy wear' },
        { title: 'Second-skin', text: 'Smooth under knits and denim' },
        { title: 'High-cut leg', text: 'Lengthens the silhouette' },
      ],
      fit: ['Close-fitting with stretch; long torso? Size up.', 'Model is 175 cm and wears a size S.'],
    },
    'Bustier Set': {
      features: [
        { title: 'Flexible boning', text: 'Sculpts without restricting' },
        { title: '3-step hook & eye', text: 'Adjustable back closure' },
        { title: 'Detachable suspenders', text: 'Two looks in one' },
      ],
      fit: ['Structured fit; choose by bust and waist.', 'Between sizes? Size up — the boning has no stretch.', 'Model is 175 cm and wears a size S.'],
    },
    Sleepwear: {
      features: [
        { title: 'Brushed cotton', text: 'Soft, breathable jersey' },
        { title: 'Relaxed cut', text: 'Made for slow mornings' },
        { title: 'Pre-washed', text: 'No shrinking, no surprises' },
      ],
      fabric: [['Main', '100% brushed cotton jersey'], ['Trim', 'Stretch lace, 86% nylon, 14% elastane']],
      care: ['Machine wash cold', 'Wash with similar colours', 'Do not bleach', 'Low tumble dry', 'Cool iron'],
    },
  };

  // body measurements, cm
  const ALPHA = [
    { size: 'XS', bust: [78, 82], underbust: [63, 67], waist: [58, 62], hips: [84, 88] },
    { size: 'S', bust: [83, 87], underbust: [68, 72], waist: [63, 67], hips: [89, 93] },
    { size: 'M', bust: [88, 92], underbust: [73, 77], waist: [68, 72], hips: [94, 98] },
    { size: 'L', bust: [93, 98], underbust: [78, 82], waist: [73, 78], hips: [99, 104] },
    { size: 'XL', bust: [99, 105], underbust: [83, 87], waist: [79, 85], hips: [105, 111] },
  ];
  // band (in) -> underbust range (cm); cup = bust − underbust (cm), see cupRange()
  const BANDS = [
    { band: 30, underbust: [63, 67] }, { band: 32, underbust: [68, 72] }, { band: 34, underbust: [73, 77] },
    { band: 36, underbust: [78, 82] }, { band: 38, underbust: [83, 87] }, { band: 40, underbust: [88, 92] },
  ];
  const CUPS = ['AA', 'A', 'B', 'C', 'D', 'DD', 'E', 'F'];

  window.WeenPdp = {
    ALPHA, BANDS, CUPS,
    extra(p) { return { ...DEFAULT, ...((p && BY_TYPE[p.type]) || {}) }; },
    isBraSized(p) { const s = p && p.options.find((o) => o.name === 'Size'); return !!(s && s.values.some((v) => /^\d/.test(v))); },
    /* measurements in cm -> { band, cup, bra: '34B', alpha: 'S' }
       band from the underbust table above; cup from bust − underbust (EU method: AA 10–12 cm, A 12–14, B 14–16 …) */
    recommend(underbustCm, bustCm) {
      if (!(underbustCm > 50 && bustCm > underbustCm)) return null;
      const row = BANDS.find((r) => underbustCm < r.underbust[1] + 1) || BANDS[BANDS.length - 1];
      const band = underbustCm < BANDS[0].underbust[0] ? BANDS[0].band : row.band;
      const cup = CUPS[Math.min(CUPS.length - 1, Math.max(0, Math.floor((bustCm - underbustCm - 10) / 2)))];
      const alphaRow = ALPHA.find((r) => bustCm < r.bust[1] + 1) || ALPHA[ALPHA.length - 1];
      return { band, cup, bra: `${band}${cup}`, alpha: alphaRow.size };
    },
    // cup index (0 = AA) -> bust − underbust range in cm
    cupRange(i) { return [10 + i * 2, 12 + i * 2]; },
  };
})();
