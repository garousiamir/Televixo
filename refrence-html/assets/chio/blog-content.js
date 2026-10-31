/*
 * Chio journal — rich article bodies, author bios and seed comments for the blog + article pages.
 * Becomes the article's rich-text `content` (and metafields) in Shopify; THEME.articles (catalog.js) stays the index.
 *
 * Body blocks:
 *   { t: 'lead', text }                     intro paragraph (larger)
 *   { t: 'p', html }                        paragraph (inline <strong>/<em>/<a> allowed)
 *   { t: 'h2', text }                       section heading (feeds the table of contents)
 *   { t: 'h3', text }
 *   { t: 'quote', text, cite }
 *   { t: 'ul' | 'ol', items: [] }
 *   { t: 'img', src, alt, caption }
 *   { t: 'shop', title, handles: [] }       "Shop the look" product embed
 *   { t: 'tip', title, text }               highlighted note
 */
(function () {
  const IMG = 'assets/images/chio/';

  const bios = {
    'Rehy P.': 'Rehy has styled Chio’s lookbooks since the first collection. She believes a good outfit starts with one piece you love and three you can rely on.',
    'Emma R.': 'Emma buys knitwear and accessories for Chio and spends most of the year visiting mills in Portugal and Scotland.',
    'Lina K.': 'Lina leads sustainability at Chio — from fibre sourcing to repair programmes — and writes about wearing things for longer.',
  };

  const bodies = {
    'how-to-style-in-the-winter': [
      { t: 'lead', text: 'Winter dressing is really about proportion. Get the base, the middle and the outer layer right and you can stay warm without ever looking bulky.' },
      { t: 'h2', text: 'Start close, then build outward' },
      { t: 'p', html: 'Begin with a close base — a rib knit or a fitted tee — and build outward with texture: a chunky cardigan, then a <strong>cropped puffer</strong> that stops at the waist so your silhouette never disappears.' },
      { t: 'ul', items: ['Base: fine rib, merino or a heavyweight cotton tee', 'Middle: a chunky knit or brushed fleece', 'Outer: a cropped puffer or a long, belted coat — never both'] },
      { t: 'img', src: `${IMG}blog/inline-1.jpg`, alt: 'Model in a cream knit and long hair standing against a white building', caption: 'A cream knit under a cropped puffer keeps the waist visible.' },
      { t: 'h2', text: 'Keep the palette tight' },
      { t: 'p', html: 'Cream, heather grey and black do the heavy lifting; let one piece carry colour, like a forest-green knit or a cobalt sweatshirt peeking from under a coat.' },
      { t: 'quote', text: 'Pick one colour per outfit and let everything else be quiet. That is how winter looks expensive.', cite: 'Rehy P., Style editor' },
      { t: 'shop', title: 'Shop the winter layers', handles: ['cream-puffer-jacket', 'chunky-knit-cardigan', 'suede-western-boots'] },
      { t: 'h2', text: 'Finish with the right shoe' },
      { t: 'p', html: 'A suede western boot works with wide-leg trousers and with a mini dress and thick tights — the most versatile pair you will own this season.' },
      { t: 'tip', title: 'Stylist tip', text: 'Spray suede with a protector before the first wear and brush it after every rainy day. It will look better in March than it did in November.' },
      { t: 'h2', text: 'Three outfits to copy' },
      { t: 'ol', items: ['Cream puffer, cobalt sweatshirt, black wide-leg trousers, western boots.', 'Chunky cardigan buttoned as a top, ribbed mini dress, opaque tights.', 'Trench over a fleece hoodie with relaxed joggers for the weekend.'] },
    ],
    'the-art-of-the-floral-dress': [
      { t: 'lead', text: 'Prints that feel grown-up, fabrics that breathe, and three ways to wear a floral dress from brunch to dinner.' },
      { t: 'h2', text: 'Scale is everything' },
      { t: 'p', html: 'A good floral is all about scale. <strong>Ditsy prints</strong> read as a texture from afar — easy to pair with a trench or a denim jacket — while large blooms are a statement on their own.' },
      { t: 'img', src: `${IMG}blog/inline-2.jpg`, alt: 'Model in a soft light with a daisy in her hair', caption: 'Soft, small-scale florals work from morning to evening.' },
      { t: 'h2', text: 'Choose fibres that move' },
      { t: 'p', html: 'Look for natural or responsibly made fibres such as linen and ECOVERO™ viscose: they drape, breathe and soften with every wash.' },
      { t: 'ul', items: ['Linen: crisp at first, softer every wash', 'Viscose: fluid drape, cool on the skin', 'Cotton voile: light, slightly sheer, perfect for heat'] },
      { t: 'shop', title: 'Shop the florals', handles: ['floral-tea-dress', 'linen-shirt-dress', 'metallic-leather-wristlet'] },
      { t: 'h2', text: 'From brunch to dinner' },
      { t: 'p', html: 'For evening, swap your sneakers for a heeled sandal and add a single metallic accessory. That is all it takes.' },
      { t: 'quote', text: 'A floral dress is the easiest way to look like you tried — without trying.', cite: 'Lina K., Sustainability lead' },
    ],
    'investing-in-a-trench': [
      { t: 'lead', text: 'Cost per wear, timeless design and the details that separate a great trench from a good one.' },
      { t: 'h2', text: 'The maths of cost per wear' },
      { t: 'p', html: 'A well-made trench coat is one of the few pieces that never really goes out of style. Divide its price by the number of seasons you will wear it and it quickly becomes <strong>the best value in your wardrobe</strong>.' },
      { t: 'tip', title: 'Quick sum', text: 'A $249 trench worn 60 days a year for five years costs less than $0.85 per wear.' },
      { t: 'h2', text: 'Details worth checking' },
      { t: 'ul', items: ['Tightly woven cotton gabardine with a water-repellent finish', 'A storm flap and a lined back yoke', 'A belt you can tie rather than buckle', 'Horn or corozo buttons, stitched with a shank'] },
      { t: 'img', src: `${IMG}blog/cover-3.jpg`, alt: 'Model in a sand trench coat over a white shirt', caption: 'Worn open over a crisp shirt — the trench in its natural habitat.' },
      { t: 'shop', title: 'Shop the look', handles: ['classic-trench-coat', 'tailored-wide-leg-trousers'] },
      { t: 'h2', text: 'How to wear it' },
      { t: 'p', html: 'Wear it open over a tee and wide-leg trousers, or belted over a mini dress — the trench adapts to you.' },
    ],
    'city-layers-guide': [
      { t: 'lead', text: 'Three-piece formulas for days that start cold, warm up by noon and end on a terrace.' },
      { t: 'h2', text: 'Think in threes' },
      { t: 'p', html: 'Think in threes: a base, a mid-layer and something to throw over your shoulders. Each piece should work <em>on its own</em> when the others come off.' },
      { t: 'h2', text: 'The hero mid-layer' },
      { t: 'p', html: 'Knitwear is the hero mid-layer — light enough to carry, warm enough to matter. Choose a cropped cut so it sits neatly over skirts and high-rise trousers.' },
      { t: 'img', src: `${IMG}blog/inline-3.jpg`, alt: 'Model in a cream dress outside a house with a terracotta roof', caption: 'Light layers that come off as the day warms up.' },
      { t: 'shop', title: 'Shop city layers', handles: ['chunky-knit-cardigan', 'metallic-leather-wristlet', 'ribbed-mini-dress'] },
      { t: 'h2', text: 'Carry less' },
      { t: 'p', html: 'A wristlet holds the essentials and slips inside a coat pocket when you need your hands free.' },
      { t: 'quote', text: 'If it does not work on its own, it does not belong in the layer.', cite: 'Emma R., Buyer' },
    ],
    'caring-for-your-knitwear': [
      { t: 'lead', text: 'Wash less, fold more: the simple routine that keeps wool and alpaca soft for years.' },
      { t: 'h2', text: 'Wash less than you think' },
      { t: 'p', html: 'Wool is naturally odour-resistant, so most knits only need airing between wears. When you do wash, use <strong>cold water and a wool detergent</strong>, and never wring.' },
      { t: 'ol', items: ['Turn the knit inside out.', 'Soak for ten minutes in cold water with a wool detergent.', 'Press the water out gently against the side of the basin.', 'Roll in a towel to remove the rest.'] },
      { t: 'h2', text: 'Dry flat, store folded' },
      { t: 'p', html: 'Dry flat on a towel, reshaping while damp. Hanging stretches the shoulders; folding keeps them perfect.' },
      { t: 'tip', title: 'Moths', text: 'Cedar blocks and lavender sachets help, but clean storage helps more — moths love the oils left on worn wool.' },
      { t: 'h2', text: 'Dealing with pilling' },
      { t: 'p', html: 'Pilling is normal on soft fibres. A fabric comb removes it in a minute and makes an old favourite look new again.' },
      { t: 'shop', title: 'Knits worth caring for', handles: ['forest-cable-knit-sweater', 'chunky-knit-cardigan'] },
    ],
    'soft-tailoring-is-here': [
      { t: 'lead', text: 'Relaxed blazers, fluid trousers and the end of the stiff office uniform.' },
      { t: 'h2', text: 'Tailoring that moves' },
      { t: 'p', html: 'The new tailoring is about movement. Fluid trousers with a pressed crease look sharp but feel like joggers, and unstructured blazers fold into a tote.' },
      { t: 'h2', text: 'Relaxed meets precise' },
      { t: 'p', html: 'Pair them with a fitted rib top or a simple tee — the contrast between relaxed and precise is what makes it feel modern.' },
      { t: 'shop', title: 'Shop soft tailoring', handles: ['tailored-wide-leg-trousers', 'vintage-logo-tee'] },
      { t: 'h2', text: 'Build a capsule' },
      { t: 'p', html: 'Neutral tones like stone, ecru and black mean every piece works together, which is the whole point of a capsule wardrobe.' },
      { t: 'ul', items: ['Two trousers: one black, one stone', 'Three tops: a tee, a rib tank, a crisp shirt', 'One layer: a trench or an unstructured blazer'] },
    ],
  };

  const comments = {
    'how-to-style-in-the-winter': [
      { name: 'Sara M.', avatar: `${IMG}avatar-4.jpg`, date: '2026-10-11', text: 'The cropped puffer + wide-leg trousers tip changed how I dress for work. No more marshmallow silhouette!', likes: 14 },
      { name: 'Julia T.', avatar: `${IMG}avatar-6.jpg`, date: '2026-10-10', text: 'Do the western boots run true to size? I’m between a 38 and 39.', likes: 3,
        reply: { name: 'Chio Team', text: 'They run true to size, Julia — if you’re between sizes and like thick socks, go for the 39.' } },
      { name: 'Noor A.', avatar: `${IMG}avatar-7.jpg`, date: '2026-10-09', text: 'Saving outfit #2 for the holidays. Thank you for writing guides that actually work in real life.', likes: 9 },
    ],
    'the-art-of-the-floral-dress': [
      { name: 'Mia L.', avatar: `${IMG}avatar-5.jpg`, date: '2026-09-30', text: 'Linen florals are my summer uniform. Loved the point about print scale.', likes: 6 },
      { name: 'Hana S.', avatar: `${IMG}avatar-8.jpg`, date: '2026-09-29', text: 'The tea dress with a trench is exactly what I needed for early autumn.', likes: 2 },
    ],
    'investing-in-a-trench': [
      { name: 'Clara W.', avatar: `${IMG}avatar-2.jpg`, date: '2026-09-16', text: 'Bought my trench three years ago and still wear it weekly. Cost per wear is real!', likes: 11 },
    ],
    'caring-for-your-knitwear': [
      { name: 'Ava D.', avatar: `${IMG}avatar-6.jpg`, date: '2026-08-15', text: 'The towel-roll trick saved my favourite cardigan. Thank you!', likes: 8 },
      { name: 'Leah P.', avatar: `${IMG}avatar-4.jpg`, date: '2026-08-13', text: 'Which fabric comb do you recommend?', likes: 1,
        reply: { name: 'Chio Team', text: 'Any wooden comb with fine metal teeth works — we use one with a cedar handle in the studio.' } },
    ],
  };

  window.CHIO_JOURNAL = { bios, bodies, comments };

  /* tiny shared store for saved (hearted) posts — persisted like the other chio:* keys */
  document.addEventListener('alpine:init', () => {
    const K = 'chio:saved_posts';
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(K)) || []; } catch (e) { saved = []; }
    if (window.Alpine.store('journal')) return;
    window.Alpine.store('journal', {
      saved,
      has(h) { return this.saved.includes(h); },
      toggle(h) {
        this.saved = this.has(h) ? this.saved.filter((x) => x !== h) : [...this.saved, h];
        try { localStorage.setItem(K, JSON.stringify(this.saved)); } catch (e) { /* private mode */ }
        window.Alpine.store('ui').toast(this.has(h) ? 'Article saved' : 'Removed from saved articles');
      },
    });
  });

  /* helpers shared by blog + article sections */
  window.ChioJournal = {
    date(d, long = false) {
      const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
      const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] || '';
      return `${day} ${long ? M : M.slice(0, 3)} ${y}`;
    },
    views(n) { return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n); },
    slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); },
    tags() {
      const counts = {};
      (window.THEME.articles || []).forEach((a) => a.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    },
  };
})();
