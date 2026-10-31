/*
 * Ween catalog — static stand-in for Shopify's product / collection / article Liquid objects.
 * Shape documented in assets/js/store.js. Money in cents. Load BEFORE assets/js/store.js.
 *
 * Extra (theme-only) fields, would become metafields:
 *   product.cutout     true when featured_image is a transparent .webp cut-out (cards use object-contain)
 *   product.card_pos   Figma crop of the cut-out inside the product-card image box ("--il:…%;--dil:…%")
 *   product.details[]  bullet list for the PDP ("Fabric & care")
 *   option.swatches    { colorName: '#hex' } for Color options
 *   collection.tile_pos Figma crop of the cut-out inside the square category tile
 */
(function () {
  const IMG = 'assets/images/ween/';
  const v = (o) => Object.entries(o).map(([k, val]) => `--${k}:${val}%`).join(';');

  const COLORS = {
    Black: '#000000', Raspberry: '#e0385d', Orchid: '#a732f0', Crimson: '#b3122e', Ivory: '#efe9df',
    Blush: '#e9b8b0', Noir: '#1c1c1c', Wine: '#6d1a2a', White: '#ffffff', Rouge: '#d21f3c', Grey: '#b9b9b9',
  };
  const ALPHA = ['XS', 'S', 'M', 'L', 'XL'];
  const BRA = ['32A', '32B', '34A', '34B', '34C', '36B', '36C', '36D', '38C', '38D'];

  let vid = 41000;
  // p: { handle, title, type, price, compare, colors[], sizes[], soldOut: ['Color/Size', …], … }
  function product(id, p) {
    const sizes = p.sizes || ALPHA;
    const colors = p.colors || ['Black'];
    const variants = [];
    // variant order decides the default (first available) variant; p.featured_color goes first
    const order = p.featured_color ? [p.featured_color, ...colors.filter((c) => c !== p.featured_color)] : colors;
    order.forEach((c) => sizes.forEach((s) => {
      variants.push({
        id: vid++, title: `${c} / ${s}`, options: [c, s], option1: c, option2: s,
        sku: `WN-${String(id).padStart(3, '0')}-${c.slice(0, 3).toUpperCase()}-${s}`,
        price: p.price, compare_at_price: p.compare || null,
        available: !(p.soldOut || []).includes(`${c}/${s}`),
      });
    }));
    const swatches = Object.fromEntries(colors.map((c) => [c, COLORS[c]]));
    const images = p.images.map((src) => (src.startsWith('assets/') ? src : IMG + src));
    return {
      id, handle: p.handle, title: p.title, vendor: 'Ween', type: p.type, tags: p.tags || [],
      price: p.price, compare_at_price: p.compare || null,
      available: variants.some((x) => x.available),
      rating: p.rating, rating_count: p.reviews,
      featured_image: images[0], images,
      cutout: images[0].endsWith('.webp'),
      card_pos: p.card_pos || '',
      options: [{ name: 'Color', values: colors, swatches }, { name: 'Size', values: sizes }],
      variants,
      collections: p.collections,
      description: p.description,
      details: p.details || ['Soft-touch French lace with a hint of stretch', 'Nickel-free adjustable hardware', 'Hand wash cold, lay flat to dry'],
      url: `ween-product.html?handle=${p.handle}`,
      created_at: p.created || '2026-08-01',
    };
  }

  const products = [
    product(1, {
      handle: 'scarlet-lace-garter-set', title: 'Scarlet Lace Garter Set', type: 'Garter Belt',
      price: 5490, colors: ['Black', 'Raspberry', 'Orchid'], featured_color: 'Raspberry', sizes: ['S', 'M', 'L'], rating: 4.4, reviews: 128,
      images: ['product-1.webp', 'cat-1.webp', 'products/scarlet-lace-set.jpg'],
      card_pos: v({ il: 1.17, it: 22.36, iw: 98.42, ih: 66.26, dil: 9.73, dit: 23.06, diw: 80.62, dih: 65.34 }),
      collections: ['garter-belt', 'lace-panty', 'top-products'], tags: ['lace', 'garter', 'set', 'red', 'bestseller'], created: '2026-07-02',
      description: 'A floral-lace garter belt paired with a matching thong. Scalloped edges, four adjustable suspender straps and soft elastic that stays in place all evening.',
    }),
    product(2, {
      handle: 'elegant-lace-bralette', title: 'Elegant Lace Bralette', type: 'Bra',
      price: 3990, compare: 5690, colors: ['Black', 'Raspberry', 'Orchid'], featured_color: 'Raspberry', sizes: ['S', 'M', 'L'], rating: 4.3, reviews: 214,
      images: ['product-2.webp', 'cat-2.webp', 'products/crimson-lace-bra.jpg'],
      card_pos: v({ il: 18.8, it: 6.5, iw: 62.4, ih: 87, dil: 21.74, dit: 0, diw: 56.6, dih: 94.86 }),
      collections: ['crimson-bra', 'top-products', 'sale'], tags: ['lace', 'bralette', 'bra', 'red', 'bestseller'], soldOut: ['Orchid/L'], created: '2026-06-18',
      description: 'Our signature bralette: unlined floral lace cups, a scalloped underband and matching garter. Barely-there structure that still feels supportive.',
    }),
    product(3, {
      handle: 'midnight-lace-babydoll', title: 'Midnight Lace Babydoll', type: 'Babydoll',
      price: 6490, compare: 9290, colors: ['Black', 'Raspberry', 'Orchid'], featured_color: 'Raspberry', sizes: ['S', 'M', 'L'], rating: 4.4, reviews: 96,
      images: ['product-3.webp', 'cat-4.webp', 'products/strappy-lace-set.jpg'],
      card_pos: v({ il: 25.31, it: 6.19, iw: 50.14, ih: 86.98, dil: 25.11, dit: 7.12, diw: 49.87, dih: 85.76 }),
      collections: ['lace-babydoll', 'sleepwear', 'top-products', 'sale'], tags: ['lace', 'babydoll', 'sheer', 'sleepwear'], created: '2026-05-30',
      description: 'A sheer mesh babydoll with boned lace cups, a fluted hem trimmed in rose lace and a matching thong. Made to be seen.',
    }),
    product(4, {
      handle: 'noir-strappy-lace-panty', title: 'Noir Strappy Lace Panty', type: 'Panty',
      price: 2490, compare: 3490, colors: ['Black', 'Raspberry', 'Orchid'], featured_color: 'Raspberry', sizes: ['S', 'M', 'L'], rating: 4.2, reviews: 301,
      images: ['product-4.webp', 'cat-5.webp', 'products/noir-balconette-set.jpg'],
      card_pos: v({ il: 1, it: 20.7, iw: 98, ih: 58.6, dil: 14.05, dit: 24.08, diw: 71.98, dih: 51.84 }),
      collections: ['lace-panty', 'top-products', 'sale'], tags: ['lace', 'panty', 'strappy', 'black'], created: '2026-06-02',
      description: 'Chantilly-style lace with double strappy sides and a satin bow at the front. A cotton gusset keeps it comfortable from day to night.',
    }),
    product(5, {
      handle: 'crimson-lace-bra', title: 'Crimson Lace Plunge Bra', type: 'Bra',
      price: 4890, colors: ['Crimson', 'Black'], sizes: BRA, rating: 4.7, reviews: 172,
      images: ['cat-2.webp', 'products/crimson-lace-bra.jpg', 'product-2.webp'],
      collections: ['crimson-bra', 'top-products', 'new-in'], tags: ['lace', 'bra', 'plunge', 'red', 'underwire'], soldOut: ['Crimson/32A', 'Black/38D'], created: '2026-09-21',
      description: 'A lightly lined plunge bra in crimson floral lace. Underwire support, adjustable straps and a centre bow detail.',
    }),
    product(6, {
      handle: 'rouge-lace-thong', title: 'Rouge Lace Thong', type: 'Panty',
      price: 1990, colors: ['Rouge', 'Black', 'Ivory'], sizes: ALPHA, rating: 4.6, reviews: 88,
      images: ['cat-3.webp', 'products/cherry-cotton-brief.jpg'],
      collections: ['lace-panty', 'top-products', 'new-in'], tags: ['lace', 'thong', 'panty', 'red'], created: '2026-09-12',
      description: 'All-over stretch lace with triple string sides and a tiny satin bow. Invisible under everything.',
    }),
    product(7, {
      handle: 'rose-bustier-set', title: 'Rose Lace Bustier Set', type: 'Bustier Set',
      price: 8990, compare: 11990, colors: ['Black', 'Wine'], sizes: ['S', 'M', 'L', 'XL'], rating: 4.8, reviews: 64,
      images: ['cat-6.webp', 'products/scarlet-lace-set.jpg'],
      collections: ['bustier-set', 'top-products', 'new-in', 'sale'], tags: ['lace', 'bustier', 'set', 'corset', 'red'], created: '2026-09-28',
      description: 'A boned bustier with sheer mesh panels, detachable suspenders and a matching thong. Hook-and-eye back closure with three settings.',
    }),
    product(8, {
      handle: 'crimson-garter-belt', title: 'Crimson Lace Garter Belt', type: 'Garter Belt',
      price: 3490, colors: ['Crimson', 'Black'], sizes: ['S', 'M', 'L'], rating: 4.5, reviews: 47,
      images: ['products/crimson-garter-belt.webp', 'cat-1.webp'],
      collections: ['garter-belt', 'shapewear'], tags: ['lace', 'garter', 'belt', 'red'], created: '2026-07-14',
      description: 'A wide lace garter belt with a ruffled edge, satin bow and four adjustable suspenders. Pair with any Ween thong.',
    }),
    product(9, {
      handle: 'noir-balconette-set', title: 'Noir Balconette Set', type: 'Bra',
      price: 6890, colors: ['Noir', 'Wine'], sizes: BRA, rating: 4.6, reviews: 73,
      images: ['products/noir-balconette-set.jpg', 'product-4.webp'],
      collections: ['crimson-bra', 'bustier-set', 'new-in'], tags: ['balconette', 'bra', 'set', 'black'], created: '2026-10-02',
      description: 'A lightly padded balconette and high-leg brief in matte microfibre with sheer lace insets. Sculpting without the wire digging in.',
    }),
    product(10, {
      handle: 'strappy-lace-set', title: 'Strappy Lace Lingerie Set', type: 'Lingerie Set',
      price: 5990, compare: 7490, colors: ['Black', 'Blush'], sizes: ['XS', 'S', 'M', 'L'], rating: 4.5, reviews: 118,
      images: ['products/strappy-lace-set.jpg', 'elegance.jpg'],
      collections: ['lace-bodysuit', 'new-in', 'sale'], tags: ['strappy', 'set', 'sheer', 'black', 'bralette'], created: '2026-09-30',
      description: 'Sheer tulle triangle cups framed by elastic harness straps, with a matching high-cut strappy brief.',
    }),
    product(11, {
      handle: 'sheer-mesh-bralette', title: 'Sheer Mesh Bralette', type: 'Bra',
      price: 3290, colors: ['Black', 'White'], sizes: ALPHA, rating: 4.3, reviews: 59,
      images: ['products/sheer-mesh-bralette.jpg'],
      collections: ['crimson-bra', 'new-in'], tags: ['mesh', 'bralette', 'bra', 'black'], created: '2026-10-05',
      description: 'A wire-free bralette in airy mesh with a choker neck strap and an elastic underband. Layer it, or wear it on its own.',
    }),
    product(12, {
      handle: 'everyday-cotton-bralette', title: 'Everyday Cotton Bralette', type: 'Bra',
      price: 2890, colors: ['Black', 'Grey', 'White'], sizes: ALPHA, rating: 4.9, reviews: 342,
      images: ['products/everyday-cotton-bralette.jpg', 'products/lounge-denim-bralette.jpg'],
      collections: ['shapewear', 'sleepwear'], tags: ['cotton', 'bralette', 'everyday', 'comfort'], soldOut: ['White/XS'], created: '2026-04-11',
      description: 'Breathable stretch cotton, a soft logo band and removable pads. The bralette you forget you are wearing.',
      details: ['95% organic cotton, 5% elastane', 'Removable pads', 'Machine wash cold'],
    }),
    product(13, {
      handle: 'soft-triangle-bra', title: 'Soft Triangle Bra', type: 'Bra',
      price: 3490, colors: ['Black', 'Blush'], sizes: ['XS', 'S', 'M', 'L', 'XL'], rating: 4.4, reviews: 127,
      images: ['products/soft-triangle-bra.jpg', 'products/lounge-denim-bralette.jpg'],
      collections: ['crimson-bra', 'shapewear'], tags: ['triangle', 'bra', 'wire-free', 'black'], created: '2026-08-08',
      description: 'A smooth triangle bra in second-skin microfibre with thin adjustable straps. Wire-free comfort that disappears under knits.',
    }),
    product(14, {
      handle: 'cloud-lounge-set', title: 'Cloud Cotton Lounge Set', type: 'Sleepwear',
      price: 4590, colors: ['Black', 'White'], sizes: ALPHA, rating: 4.7, reviews: 81,
      images: ['products/cloud-lounge-set.jpg', 'products/cherry-cotton-brief.jpg'],
      collections: ['sleepwear', 'new-in'], tags: ['cotton', 'lounge', 'sleepwear', 'tee', 'brief'], created: '2026-09-02',
      description: 'A cropped boxy tee and a high-rise brief in brushed cotton jersey. Built for slow mornings.',
      details: ['100% brushed cotton jersey', 'Relaxed cropped tee', 'Machine wash cold'],
    }),
    product(15, {
      handle: 'cherry-cotton-brief', title: 'Cherry Cotton Brief', type: 'Panty',
      price: 1590, compare: 2290, colors: ['Rouge', 'Black', 'White'], sizes: ALPHA, rating: 4.5, reviews: 156,
      images: ['products/cherry-cotton-brief.jpg', 'cat-3.webp'],
      collections: ['lace-panty', 'sleepwear', 'sale'], tags: ['cotton', 'brief', 'panty', 'red'], created: '2026-07-20',
      description: 'A mid-rise brief in soft stretch cotton with a lace-trimmed leg. Sold in cherry red, black and white.',
    }),
    product(16, {
      handle: 'fishnet-lace-bodysuit', title: 'Fishnet Lace Bodysuit', type: 'Bodysuit',
      price: 5290, colors: ['Black'], sizes: ['XS', 'S', 'M', 'L'], rating: 4.2, reviews: 38,
      images: ['products/fishnet-lace-bodysuit.jpg', 'collage-1.jpg'],
      collections: ['lace-bodysuit'], tags: ['fishnet', 'bodysuit', 'lace', 'black'], soldOut: ['Black/XS'], created: '2026-06-25',
      description: 'An open fishnet bodysuit with lace-trimmed cups and a high-cut leg. Snap closure.',
    }),
    product(17, {
      handle: 'onyx-sculpt-bodysuit', title: 'Onyx Sculpt Bodysuit', type: 'Bodysuit',
      price: 6990, colors: ['Black', 'Noir'], sizes: ALPHA, rating: 4.8, reviews: 92,
      images: ['products/onyx-sculpt-bodysuit.jpg', 'collage-4.jpg'],
      collections: ['lace-bodysuit', 'shapewear'], tags: ['bodysuit', 'shapewear', 'sculpt', 'black', 'long sleeve'], created: '2026-08-19',
      description: 'A long-sleeve, off-shoulder bodysuit in double-layer sculpting jersey. Smooths without squeezing; snap gusset.',
      details: ['78% nylon, 22% elastane', 'Medium-control double layer', 'Hand wash cold'],
    }),
    product(18, {
      handle: 'scarlet-lace-lingerie-set', title: 'Scarlet Lace Lingerie Set', type: 'Lingerie Set',
      price: 7490, colors: ['Crimson', 'Black'], sizes: ['S', 'M', 'L', 'XL'], rating: 4.6, reviews: 67,
      images: ['products/scarlet-lace-set.jpg', 'collage-2.jpg', 'collage-3.jpg'],
      collections: ['bustier-set', 'garter-belt', 'new-in'], tags: ['lace', 'set', 'garter', 'red'], created: '2026-10-08',
      description: 'A four-piece set: balconette bra, high-waist garter, thong and lace stockings — all in matching scarlet lace.',
    }),
  ];

  // home "Categories" tiles = the first 6 + 4 utility collections (tile_pos = Figma crop inside the square tile)
  const collections = [
    { handle: 'lace-panty', title: 'Lace Panty', image: IMG + 'cat-1.webp', cover: IMG + 'collage-1.jpg',
      tile_pos: v({ x: 17.6, y: 30.3, w: 65.5, h: 54.5, dx: 16.3, dy: 27.2, dw: 67.4, dh: 56.5 }),
      description: 'Thongs, briefs and strappy panties in French-style lace and soft cotton.' },
    { handle: 'crimson-bra', title: 'Crimson Bra', image: IMG + 'cat-2.webp', cover: IMG + 'products/crimson-lace-bra.jpg',
      tile_pos: v({ x: 12.1, y: 12.1, w: 75.2, h: 75.2, dx: 16.3, dy: 16.3, dw: 67.4, dh: 67.4 }),
      description: 'Plunge, balconette and wire-free bras — lace that supports.' },
    { handle: 'garter-belt', title: 'Garter Belt', image: IMG + 'cat-3.webp', cover: IMG + 'collage-3.jpg',
      tile_pos: v({ x: 12.1, y: 32.1, w: 75.2, h: 41.2, dx: 16.8, dy: 33.7, dw: 67.4, dh: 37.0 }),
      description: 'Lace garter belts and suspender sets with adjustable straps.' },
    { handle: 'lace-babydoll', title: 'Lace Babydoll', image: IMG + 'cat-4.webp', cover: IMG + 'elegance.jpg',
      tile_pos: v({ x: 18.8, y: 11.5, w: 62.4, h: 76.4, dx: 16.3, dy: 8.2, dw: 67.4, dh: 82.6 }),
      description: 'Sheer babydolls and chemises with scalloped lace hems.' },
    { handle: 'bustier-set', title: 'Bustier Set', image: IMG + 'cat-5.webp', cover: IMG + 'collage-2.jpg',
      tile_pos: v({ x: 12.1, y: 28.5, w: 75.2, h: 64.8, dx: 16.3, dy: 25.5, dw: 67.4, dh: 58.2 }),
      description: 'Boned bustiers and corset sets with matching briefs.' },
    { handle: 'lace-bodysuit', title: 'Lace Bodysuit', image: IMG + 'cat-6.webp', cover: IMG + 'collage-5.jpg',
      tile_pos: v({ x: 29.1, y: 10.9, w: 41.2, h: 78.2, dx: 26.6, dy: 6.0, dw: 46.7, dh: 87.5 }),
      description: 'One-piece lace, mesh and sculpting bodysuits.' },
    { handle: 'sleepwear', title: 'Sleepwear', image: IMG + 'product-3.webp', cover: IMG + 'products/cloud-lounge-set.jpg',
      tile_pos: v({ x: 25, y: 8, w: 50, h: 84, dx: 25, dy: 8, dw: 50, dh: 84 }),
      description: 'Babydolls, lounge sets and soft cotton for slow mornings.' },
    { handle: 'shapewear', title: 'Shapewear', image: IMG + 'products/crimson-garter-belt.webp', cover: IMG + 'products/onyx-sculpt-bodysuit.jpg',
      tile_pos: v({ x: 12.1, y: 30, w: 75.8, h: 40.2, dx: 16.3, dy: 32, dw: 67.4, dh: 35.7 }),
      description: 'Sculpting bodysuits, smoothing bralettes and supportive belts.' },
    { handle: 'new-in', title: 'New In', image: IMG + 'product-2.webp', cover: IMG + 'products/noir-balconette-set.jpg',
      tile_pos: v({ x: 21.5, y: 8, w: 57, h: 76, dx: 23.5, dy: 8, dw: 53, dh: 70.6 }),
      description: 'The latest drops from the Ween studio.' },
    { handle: 'sale', title: 'Sale', image: IMG + 'product-1.webp', cover: IMG + 'promo-offer.jpg',
      tile_pos: v({ x: 12.1, y: 30.5, w: 75.8, h: 48.8, dx: 16.3, dy: 32.5, dw: 67.4, dh: 43.4 }),
      description: 'Up to 30% off selected lace — while sizes last.' },
    // not in the category slider / nav: the curated home grid
    { handle: 'top-products', title: 'Top products', image: IMG + 'product-2.webp', cover: IMG + 'collage-3.jpg', hidden_in_nav: true,
      description: 'Our most-loved pieces this season.' },
  ].map((c, i) => {
    const items = products.filter((p) => p.collections.includes(c.handle));
    return { id: 300 + i, ...c, products_count: items.length, product_handles: items.map((p) => p.handle), url: `ween-shop.html?collection=${c.handle}` };
  });

  const P = (...paragraphs) => paragraphs;
  const articles = [
    { handle: 'elegance-in-every-detail', title: 'Elegance In Every Detail', cover: IMG + 'blog-1.jpg',
      card_pos: v({ il: -8.63, it: -20.16, iw: 117.86, ih: 221.1, dil: 0, dit: -67.82, diw: 100, dih: 217.88 }),
      author: 'Selo Z.', avatar: IMG + 'products/avatar-selo.jpg', date: '2026-10-06', read_time: 6, views: 3423, rating: 4.5,
      tags: ['Lace', 'Style guide'], excerpt: 'Discover premium lace lingerie designed for confidence, comfort, and timeless beauty.',
      body: P('Great lingerie starts with the details you only notice up close: a scalloped edge that lies flat, a seam placed exactly where it flatters, a strap that stays put.',
        'This season we went back to French-style floral lace and paired it with modern mesh. The result is lighter, softer and more breathable — and it still looks unmistakably Ween.',
        'When you shop lace, look for a soft hand-feel, finished edges and stretch that recovers. Those three things decide whether a piece feels special on day one or on day one hundred.',
        'Start with one hero piece — a bralette or a garter set — and build around it with basics in black and crimson.') },
    { handle: 'finding-your-perfect-fit', title: 'Your Perfect Bra Fit', cover: IMG + 'blog-2.jpg',
      card_pos: v({ il: -8.63, it: -20.16, iw: 117.86, ih: 221.1, dil: 0, dit: -83.97, diw: 100, dih: 217.88 }),
      author: 'Mara L.', avatar: IMG + 'products/avatar-mara.jpg', date: '2026-09-24', read_time: 8, views: 5180, rating: 4.8,
      tags: ['Fit', 'Bras'], excerpt: 'Band first, cups second: a five-minute guide to measuring yourself at home.',
      body: P('Around 80% of people wear the wrong bra size, and the band is almost always the culprit. It should sit level and snug on the loosest hook.',
        'Measure under your bust, keep the tape level and exhale. Then measure the fullest part of your bust; every inch of difference is roughly one cup size.',
        'If the cups wrinkle, go down a cup; if the wire sits on breast tissue, go up. Sister sizes (34B ↔ 32C ↔ 36A) share the same cup volume.',
        'Still unsure? Our size guide and free exchanges have you covered.') },
    { handle: 'caring-for-lace', title: 'How To Care For Lace', cover: IMG + 'blog-3.jpg',
      card_pos: v({ il: -8.63, it: -26, iw: 117.86, ih: 221.1, dil: 0, dit: -71.97, diw: 100, dih: 217.14 }),
      author: 'Ava C.', avatar: IMG + 'products/avatar-ava.jpg', date: '2026-09-10', read_time: 4, views: 2210, rating: 4.6,
      tags: ['Care', 'Lace'], excerpt: 'Cold water, a gentle wash and never the dryer — keep your lace looking new for years.',
      body: P('Lace is resilient when you treat it gently. Hand wash in cold water with a mild detergent and press — never wring — the water out.',
        'Fasten hooks before washing so they cannot snag, and use a mesh bag if you must use the machine on a delicate cycle.',
        'Dry flat in the shade. Heat breaks down elastane, which is what keeps your favourite pieces fitting the way they did on day one.') },
    { handle: 'the-crimson-edit', title: 'The Crimson Edit', cover: IMG + 'products/crimson-lace-bra.jpg',
      author: 'Selo Z.', avatar: IMG + 'products/avatar-selo.jpg', date: '2026-08-29', read_time: 5, views: 4102, rating: 4.7,
      tags: ['Trends', 'Crimson'], excerpt: 'Why crimson is the season’s most confident colour, and how to wear it every day.',
      body: P('Red lingerie has always been a statement. This year it is quieter — deeper crimson, softer lace, and pieces you actually reach for.',
        'Pair a crimson bralette with black for contrast, or go head-to-toe red with a garter set for an evening that feels like an occasion.',
        'Under a white shirt? Choose a shade close to your skin tone instead — save the crimson for when you want it seen.') },
    { handle: 'comfort-first-sleepwear', title: 'Sleepwear Rituals', cover: IMG + 'products/cloud-lounge-set.jpg',
      author: 'Mara L.', avatar: IMG + 'products/avatar-mara.jpg', date: '2026-08-12', read_time: 7, views: 1890, rating: 4.4,
      tags: ['Sleepwear', 'Wellbeing'], excerpt: 'Soft cotton, slow mornings and an evening routine that helps you truly switch off.',
      body: P('What you sleep in matters. Breathable cotton and loose cuts help your body regulate temperature through the night.',
        'Build a small evening ritual: dim lights, a warm shower, then change into something that feels like a deep breath.',
        'Our Cloud Cotton Lounge Set was designed for exactly that — and for the lazy Sunday that follows.') },
    { handle: 'behind-the-seams', title: 'Behind The Seams At Ween', cover: IMG + 'products/strappy-lace-set.jpg',
      author: 'Ava C.', avatar: IMG + 'products/avatar-ava.jpg', date: '2026-07-30', read_time: 9, views: 2764, rating: 4.9,
      tags: ['Studio', 'Sustainability'], excerpt: 'From the first sketch to the final stitch: how a Ween piece is made.',
      body: P('Every Ween piece starts as a hand sketch in our studio, then goes through at least three fittings on real bodies of different sizes.',
        'We work with two family-run lace mills and use recycled packaging for every order.',
        'It takes longer, and we think it shows — in the fit, in the finish and in how long your lingerie lasts.') },
  ].map((a, i) => ({ id: 500 + i, ...a, card_pos: a.card_pos || '', url: `ween-article.html?id=${a.handle}` }));

  window.THEME = {
    key: 'ween',
    name: 'Ween',
    currency: 'USD',
    money_format: '${{amount}}',
    free_shipping_threshold: 15000,
    discount_codes: { WEEN10: 10, WELCOME15: 15, LACE20: 20 },
    popular_searches: ['Lace bralette', 'Crimson', 'Babydoll', 'Garter', 'Bodysuit', 'Cotton'],
    colors: COLORS,
    products,
    collections,
    articles,
  };
})();
