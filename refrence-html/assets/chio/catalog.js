/*
 * Chio catalog — static stand-in for Shopify's product / collection / article Liquid objects.
 * Shapes follow assets/js/store.js (money in cents). Extra fields used by Chio pages:
 *   product.options[i].swatches  -> hex per value for the "Color" option (same order as values)
 *   product.material / fit / care / details[] / badge / created_at / best_selling_rank / sold
 *   collection.products_count (computed below), collection.image, collection.url
 *   article: { id, handle, title, excerpt, cover, author, avatar, author_role, date, read_time, views, tags[], body[], url }
 */
(function () {
  const IMG = 'assets/images/chio/';
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const COLORS = {
    Black: '#141414', White: '#f4f4f2', Cream: '#efe6d6', Heather: '#d9d7d3', Cobalt: '#1f7fd1', Rust: '#c4583b',
    Coral: '#ec5b5b', Forest: '#2f4a33', Sand: '#c9b49a', Stone: '#a8a39a', Camel: '#b07b4f', Gold: '#d6b56d',
    Floral: '#e0b7a5', Ecru: '#ece5d4', Sage: '#9fb39a', Navy: '#1f2a44', Grey: '#9a9a9a',
  };

  let vid = 41000;
  /* build a product: colors x sizes variants; `soldOut` lists "Color/Size" (or "*" for all) that are unavailable */
  function product(id, d) {
    const colors = d.colors; const sizes = d.sizes === undefined ? SIZES : d.sizes;
    const soldOut = d.soldOut || [];
    const options = [{ name: 'Color', values: colors, swatches: colors.map((c) => COLORS[c] || '#ccc') }];
    if (sizes && sizes.length) options.push({ name: 'Size', values: sizes });
    const variants = [];
    colors.forEach((c) => (sizes && sizes.length ? sizes : [null]).forEach((s) => {
      const opts = s ? [c, s] : [c];
      const key = opts.join('/');
      variants.push({
        id: ++vid, title: opts.join(' / '), options: opts, sku: `CH-${id}-${opts.join('-')}`.toUpperCase(),
        price: d.price, compare_at_price: d.compare_at_price || null,
        available: !(soldOut.includes('*') || soldOut.includes(key) || soldOut.includes(c) || (s && soldOut.includes(s))),
      });
    }));
    const images = d.images.map((n) => (n.includes('/') ? IMG + n : `${IMG}products/${n}`));
    return {
      id, handle: d.handle, title: d.title, vendor: 'Chio', type: d.type, tags: d.tags,
      price: d.price, compare_at_price: d.compare_at_price || null,
      available: variants.some((v) => v.available),
      rating: d.rating, rating_count: d.rating_count,
      featured_image: images[0], images, options, variants,
      collections: d.collections, description: d.description,
      material: d.material, fit: d.fit, care: d.care || 'Machine wash cold, inside out. Do not tumble dry. Cool iron if needed.',
      details: d.details || [], badge: d.badge || null,
      created_at: d.created_at, best_selling_rank: d.rank, sold: d.sold || 0,
      url: `chio-product.html?handle=${d.handle}`,
    };
  }

  const products = [
    product(1, { handle: 'vintage-logo-tee', title: 'Vintage Logo Tee', type: 'T-Shirt', price: 7200,
      colors: ['Rust', 'White', 'Black'], soldOut: ['White/XS', 'Black/XXL'], rating: 4.6, rating_count: 128,
      images: ['vintage-logo-tee-1.jpg', 'vintage-logo-tee-2.jpg', 'vintage-logo-tee-3.jpg'],
      collections: ['tops', 'new-in'], tags: ['cotton', 'graphic', 'oversized', 'tee', 'summer'], badge: 'New',
      description: 'A heavyweight cotton tee with a washed vintage logo print and a relaxed, boxy fit. Pairs as easily with a pleated skirt as it does with your favourite denim.',
      material: '100% organic cotton, 220 gsm jersey', fit: 'Oversized — size down for a closer fit',
      details: ['Garment-dyed for a lived-in colour', 'Ribbed crew neck', 'Dropped shoulders'], created_at: '2026-09-28', rank: 3, sold: 412 }),
    product(2, { handle: 'oversized-graphic-sweatshirt', title: 'Oversized Graphic Sweatshirt', type: 'Sweatshirt', price: 7200,
      colors: ['Cobalt', 'Heather', 'Black'], soldOut: ['Cobalt/XXL'], rating: 4.8, rating_count: 96,
      images: ['oversized-graphic-sweatshirt-1.jpg', 'oversized-graphic-sweatshirt-2.jpg', 'oversized-graphic-sweatshirt-3.jpg'],
      collections: ['hoodies', 'new-in'], tags: ['fleece', 'graphic', 'oversized', 'sweatshirt'],
      description: 'Our softest brushed fleece in a statement cobalt, cut long and roomy with a tonal chest print. Made for slow weekends and layered city days.',
      material: '80% cotton, 20% recycled polyester brushed fleece', fit: 'Oversized, longline',
      details: ['Brushed inner for warmth', 'Ribbed cuffs and hem', 'Screen-printed artwork'], created_at: '2026-09-20', rank: 1, sold: 530 }),
    product(3, { handle: 'heather-sweatshirt-dress', title: 'Heather Sweatshirt Dress', type: 'Dress', price: 7200, compare_at_price: 8200,
      colors: ['Heather', 'Black'], soldOut: ['Heather/XXL'], rating: 4.6, rating_count: 74,
      images: ['heather-sweatshirt-dress-1.jpg', 'heather-sweatshirt-dress-2.jpg', 'heather-sweatshirt-dress-3.jpg'],
      collections: ['short-dress', 'hoodies', 'sale'], tags: ['fleece', 'dress', 'cosy', 'sale'], badge: 'Sale',
      description: 'The comfort of your favourite sweatshirt, reworked as an easy mini dress with a mock neck and blouson sleeves.',
      material: '70% cotton, 30% polyester loopback', fit: 'Relaxed through the body, mid-thigh length', created_at: '2026-08-12', rank: 6, sold: 260 }),
    product(4, { handle: 'black-fleece-hoodie', title: 'Black Fleece Hoodie', type: 'Hoodie', price: 7200,
      colors: ['Black'], soldOut: ['*'], rating: 4.7, rating_count: 211,
      images: ['black-fleece-hoodie-1.jpg', 'black-fleece-hoodie-2.jpg'],
      collections: ['hoodies'], tags: ['fleece', 'hoodie', 'essentials'],
      description: 'A cropped, structured hoodie in dense black fleece. Wear it with the matching joggers for the full set.',
      material: '100% cotton fleece, 380 gsm', fit: 'Cropped, boxy', created_at: '2026-06-02', rank: 2, sold: 690 }),
    product(5, { handle: 'relaxed-fleece-joggers', title: 'Relaxed Fleece Joggers', type: 'Pants', price: 6800,
      colors: ['Black', 'Heather'], soldOut: ['Black/XXL', 'Heather/XS'], rating: 4.5, rating_count: 158,
      images: ['relaxed-fleece-joggers-1.jpg', 'relaxed-fleece-joggers-2.jpg', 'relaxed-fleece-joggers-3.jpg'],
      collections: ['pants'], tags: ['fleece', 'joggers', 'pants', 'essentials'],
      description: 'Slouchy, high-rise joggers with a wide elastic waistband and cuffed ankles. The everyday pant you will reach for first.',
      material: '100% cotton fleece', fit: 'Relaxed, tapered leg', created_at: '2026-07-18', rank: 4, sold: 388 }),
    product(6, { handle: 'suede-western-boots', title: 'Suede Western Ankle Boots', type: 'Boots', price: 18900, compare_at_price: 22900,
      colors: ['Camel', 'Black'], sizes: ['36', '37', '38', '39', '40', '41'], soldOut: ['Camel/41', 'Black/36'], rating: 4.9, rating_count: 63,
      images: ['suede-western-boots-1.jpg', 'suede-western-boots-2.jpg', 'suede-western-boots-3.jpg'],
      collections: ['shoes', 'sale'], tags: ['suede', 'boots', 'shoes', 'leather', 'sale'], badge: 'Sale',
      description: 'Pointed-toe ankle boots in soft camel suede with a stacked western heel and side pull tabs.',
      material: 'Calf suede upper, leather lining, rubber sole', fit: 'True to size; 6 cm heel',
      care: 'Brush gently with a suede brush. Protect with a suede spray before wearing.', created_at: '2026-09-02', rank: 7, sold: 140 }),
    product(7, { handle: 'ribbed-mini-dress', title: 'Ribbed Sleeveless Mini Dress', type: 'Dress', price: 7200, compare_at_price: 8200,
      colors: ['Black', 'Cream'], soldOut: ['Cream/XXL'], rating: 4.6, rating_count: 89,
      images: ['ribbed-mini-dress-1.jpg', 'ribbed-mini-dress-2.jpg', 'ribbed-mini-dress-3.jpg'],
      collections: ['short-dress', 'sale'], tags: ['ribbed', 'dress', 'mini', 'sale', 'summer'], badge: 'Sale',
      description: 'A second-skin rib knit with a high racer neckline that skims the body and stops just above the knee.',
      material: '95% viscose, 5% elastane rib', fit: 'Bodycon, stretch', created_at: '2026-08-25', rank: 5, sold: 301 }),
    product(8, { handle: 'cream-puffer-jacket', title: 'Cream Puffer Jacket', type: 'Jacket', price: 7200, compare_at_price: 8200,
      colors: ['Cream', 'Black'], soldOut: ['Cream/XXL'], rating: 4.6, rating_count: 57,
      images: ['cream-puffer-jacket-1.jpg', 'cream-puffer-jacket-2.jpg', 'cream-puffer-jacket-3.jpg'],
      collections: ['jacket', 'sale'], tags: ['puffer', 'jacket', 'winter', 'sale'], badge: 'Sale',
      description: 'A cloud-soft cropped puffer with a funnel neck and two-way zip, padded with recycled fill for warmth without weight.',
      material: 'Shell: 100% recycled nylon. Fill: recycled polyester', fit: 'Relaxed, cropped at the waist', created_at: '2026-09-10', rank: 9, sold: 122 }),
    product(9, { handle: 'metallic-leather-wristlet', title: 'Metallic Leather Wristlet', type: 'Bag', price: 12900,
      colors: ['Gold', 'Black'], sizes: [], soldOut: [], rating: 4.4, rating_count: 41,
      images: ['metallic-leather-wristlet-1.jpg', 'metallic-leather-wristlet-2.jpg'],
      collections: ['bag', 'new-in'], tags: ['leather', 'bag', 'accessories', 'gift'], badge: 'New',
      description: 'A pebbled metallic leather pouch with a detachable wrist strap — just big enough for phone, cards and keys.',
      material: 'Pebbled metallic cowhide, cotton lining', fit: '19 × 12 × 2 cm', care: 'Wipe clean with a dry cloth.',
      created_at: '2026-10-01', rank: 12, sold: 75 }),
    product(10, { handle: 'peace-out-graphic-hoodie', title: 'Peace Out Graphic Hoodie', type: 'Hoodie', price: 8900,
      colors: ['Coral', 'Heather'], soldOut: ['Coral/XXL'], rating: 4.8, rating_count: 102,
      images: ['peace-out-graphic-hoodie-1.jpg', 'peace-out-graphic-hoodie-2.jpg'],
      collections: ['hoodies', 'new-in'], tags: ['hoodie', 'graphic', 'fleece', 'oversized'], badge: 'New',
      description: 'An oversized coral hoodie with a playful puff-print graphic, deep hood and kangaroo pocket.',
      material: '80% cotton, 20% polyester fleece', fit: 'Oversized', created_at: '2026-10-05', rank: 8, sold: 160 }),
    product(11, { handle: 'chunky-knit-cardigan', title: 'Chunky Knit Cardigan', type: 'Cardigan', price: 7200, compare_at_price: 8200,
      colors: ['Grey', 'Cream'], soldOut: ['Grey/XXL'], rating: 4.6, rating_count: 66,
      images: ['chunky-knit-cardigan-1.jpg', 'chunky-knit-cardigan-2.jpg', 'chunky-knit-cardigan-3.jpg'],
      collections: ['tops', 'sale'], tags: ['knit', 'cardigan', 'wool', 'sale'], badge: 'Sale',
      description: 'A cropped cardigan in a chunky wool-blend knit, with oversized horn-effect buttons and dropped shoulders.',
      material: '50% wool, 30% alpaca, 20% polyamide', fit: 'Cropped, relaxed',
      care: 'Hand wash cold, dry flat.', created_at: '2026-09-15', rank: 10, sold: 118 }),
    product(12, { handle: 'tailored-wide-leg-trousers', title: 'Tailored Wide-Leg Trousers', type: 'Pants', price: 11900,
      colors: ['Stone', 'Black'], soldOut: ['Stone/XXL'], rating: 4.7, rating_count: 48,
      images: ['tailored-wide-leg-trousers-1.jpg', 'tailored-wide-leg-trousers-2.jpg', 'tailored-wide-leg-trousers-3.jpg'],
      collections: ['pants', 'new-in'], tags: ['tailoring', 'trousers', 'pants', 'workwear'], badge: 'New',
      description: 'Fluid wide-leg trousers with a high waist, front pleats and pressed creases — tailoring that moves with you.',
      material: '64% recycled polyester, 34% viscose, 2% elastane', fit: 'High rise, full length wide leg', created_at: '2026-10-08', rank: 11, sold: 96 }),
    product(13, { handle: 'forest-cable-knit-sweater', title: 'Forest Cable-Knit Sweater', type: 'Sweater', price: 9800, compare_at_price: 12800,
      colors: ['Forest', 'Cream'], soldOut: ['Forest/XXL', 'Cream/XL'], rating: 4.5, rating_count: 37,
      images: ['forest-cable-knit-sweater-1.jpg', 'forest-cable-knit-sweater-2.jpg'],
      collections: ['tops', 'sale'], tags: ['knit', 'sweater', 'wool', 'winter', 'sale'], badge: 'Sale',
      description: 'A deep forest green crew-neck in a soft merino-blend with a slouchy fit. Layer it over a white tee for the off-duty look.',
      material: '70% merino wool, 30% recycled nylon', fit: 'Relaxed', care: 'Hand wash cold, dry flat.', created_at: '2026-08-30', rank: 13, sold: 70 }),
    product(14, { handle: 'floral-tea-dress', title: 'Floral Tea Dress', type: 'Dress', price: 13800,
      colors: ['Floral', 'Black'], soldOut: ['Floral/XXL'], rating: 4.8, rating_count: 29,
      images: ['floral-tea-dress-1.jpg', 'floral-tea-dress-2.jpg'],
      collections: ['short-dress', 'new-in'], tags: ['floral', 'dress', 'summer', 'viscose'], badge: 'New',
      description: 'A breezy ditsy-floral tea dress with a sweetheart neckline, puff sleeves and a flippy knee-length skirt.',
      material: '100% LENZING™ ECOVERO™ viscose', fit: 'Fitted bodice, flared skirt', created_at: '2026-10-10', rank: 14, sold: 54 }),
    product(15, { handle: 'classic-trench-coat', title: 'Classic Trench Coat', type: 'Coat', price: 24900, compare_at_price: 29900,
      colors: ['Sand', 'Black'], soldOut: ['Sand/XXL', 'Black/XS'], rating: 4.9, rating_count: 52,
      images: ['classic-trench-coat-1.jpg', 'classic-trench-coat-2.jpg'],
      collections: ['jacket', 'sale'], tags: ['trench', 'coat', 'outerwear', 'sale'], badge: 'Sale',
      description: 'Our take on the timeless trench: water-repellent cotton gabardine, storm flaps, a removable belt and horn buttons.',
      material: '100% cotton gabardine, water-repellent finish', fit: 'Relaxed, below-the-knee', care: 'Dry clean only.', created_at: '2026-09-05', rank: 15, sold: 88 }),
    product(16, { handle: 'linen-shirt-dress', title: 'Linen Button Shirt Dress', type: 'Dress', price: 11800,
      colors: ['Ecru', 'Sage'], soldOut: ['Sage/XS'], rating: 4.7, rating_count: 33,
      images: ['linen-shirt-dress-1.jpg', 'linen-shirt-dress-2.jpg'],
      collections: ['short-dress', 'new-in'], tags: ['linen', 'dress', 'summer', 'shirt dress'], badge: 'New',
      description: 'A short-sleeved linen shirt dress with tortoiseshell buttons, patch pockets and a self-tie waist.',
      material: '100% European linen', fit: 'Relaxed, midi length', created_at: '2026-10-12', rank: 16, sold: 41 }),
  ];

  const collections = [
    { id: 101, handle: 'new-in', title: 'New In', image: `${IMG}products/linen-shirt-dress-1.jpg`, description: 'Fresh drops for the new season — the pieces everyone is asking about.' },
    { id: 102, handle: 'sale', title: 'Sale', image: `${IMG}offer-2.jpg`, description: 'Favourites at their lowest prices. Limited sizes, so be quick.' },
    { id: 103, handle: 'pants', title: 'Pants', image: `${IMG}cat-pants.jpg`, description: 'From slouchy joggers to fluid tailoring.' },
    { id: 104, handle: 'shoes', title: 'Shoes', image: `${IMG}cat-shoes.jpg`, description: 'Boots and everyday pairs to ground every outfit.' },
    { id: 105, handle: 'short-dress', title: 'Short Dress', image: `${IMG}cat-short-dress.jpg`, description: 'Minis, shirt dresses and easy summer silhouettes.' },
    { id: 106, handle: 'jacket', title: 'Jacket', image: `${IMG}cat-jacket.jpg`, description: 'Puffers, trenches and layers for changing weather.' },
    { id: 107, handle: 'bag', title: 'Bag', image: `${IMG}cat-bag.jpg`, description: 'Small leather goods that carry just what you need.' },
    { id: 108, handle: 'hoodies', title: 'Hoodies', image: `${IMG}cat-hoodies.jpg`, description: 'Brushed fleece hoodies and sweatshirts, made to be lived in.' },
    { id: 109, handle: 'tops', title: 'Tops & Knitwear', image: `${IMG}offer-1.jpg`, description: 'Tees, cardigans and knits for every layer.' },
  ].map((c) => ({ ...c, url: `chio-shop.html?collection=${c.handle}`, products_count: products.filter((p) => p.collections.includes(c.handle)).length }));

  const authors = {
    rehy: { name: 'Rehy P.', avatar: `${IMG}avatar-1.jpg`, role: 'Style editor' },
    emma: { name: 'Emma R.', avatar: `${IMG}avatar-9.jpg`, role: 'Buyer, knitwear' },
    lina: { name: 'Lina K.', avatar: `${IMG}avatar-3.jpg`, role: 'Sustainability lead' },
  };
  const article = (id, a) => ({ id, ...a, author: authors[a.by].name, avatar: authors[a.by].avatar, author_role: authors[a.by].role, url: `chio-article.html?id=${a.handle}` });
  const articles = [
    article(1, { handle: 'how-to-style-in-the-winter', title: 'How to style in the winter?', by: 'rehy', date: '2026-10-09', read_time: 6, views: 2340,
      cover: `${IMG}blog/cover-1.jpg`, tags: ['Fashion', 'Winter'],
      excerpt: 'Our collections are carefully selected to combine modern trends with lasting quality — here is how to layer them when the temperature drops.',
      body: [
        'Winter dressing is really about proportion. Start with a close base — a rib knit or a fitted tee — and build outward with texture: a chunky cardigan, then a cropped puffer that stops at the waist so your silhouette never disappears.',
        'Keep the palette tight. Cream, heather grey and black do the heavy lifting; let one piece carry colour, like a forest-green knit or a cobalt sweatshirt peeking from under a coat.',
        'Finish with the right shoe. A suede western boot works with wide-leg trousers and with a mini dress and thick tights — the most versatile pair you will own this season.',
      ], products: ['cream-puffer-jacket', 'chunky-knit-cardigan', 'suede-western-boots'] }),
    article(2, { handle: 'the-art-of-the-floral-dress', title: 'The art of the floral dress', by: 'lina', date: '2026-09-28', read_time: 4, views: 1280,
      cover: `${IMG}blog/cover-2.jpg`, tags: ['Fashion', 'Summer'],
      excerpt: 'Prints that feel grown-up, fabrics that breathe, and three ways to wear a floral dress from brunch to dinner.',
      body: [
        'A good floral is all about scale. Ditsy prints read as a texture from afar — easy to pair with a trench or a denim jacket — while large blooms are a statement on their own.',
        'Look for natural or responsibly made fibres such as linen and ECOVERO™ viscose: they drape, breathe and soften with every wash.',
        'For evening, swap your sneakers for a heeled sandal and add a single metallic accessory. That is all it takes.',
      ], products: ['floral-tea-dress', 'linen-shirt-dress', 'metallic-leather-wristlet'] }),
    article(3, { handle: 'investing-in-a-trench', title: 'Why a trench is worth the investment', by: 'rehy', date: '2026-09-14', read_time: 5, views: 980,
      cover: `${IMG}blog/cover-3.jpg`, tags: ['Lifestyle', 'Outerwear'],
      excerpt: 'Cost per wear, timeless design and the details that separate a great trench from a good one.',
      body: [
        'A well-made trench coat is one of the few pieces that never really goes out of style. Divide its price by the number of seasons you will wear it and it quickly becomes the best value in your wardrobe.',
        'Check the details: tightly woven gabardine, a storm flap, a lined back yoke and a belt you can tie rather than buckle.',
        'Wear it open over a tee and wide-leg trousers, or belted over a mini dress — the trench adapts to you.',
      ], products: ['classic-trench-coat', 'tailored-wide-leg-trousers'] }),
    article(4, { handle: 'city-layers-guide', title: 'A short guide to city layers', by: 'emma', date: '2026-08-30', read_time: 3, views: 760,
      cover: `${IMG}blog/cover-4.jpg`, tags: ['Lifestyle', 'Fashion'],
      excerpt: 'Three-piece formulas for days that start cold, warm up by noon and end on a terrace.',
      body: [
        'Think in threes: a base, a mid-layer and something to throw over your shoulders. Each piece should work on its own when the others come off.',
        'Knitwear is the hero mid-layer — light enough to carry, warm enough to matter. Choose a cropped cut so it sits neatly over skirts and high-rise trousers.',
        'Carry less. A wristlet holds the essentials and slips inside a coat pocket when you need your hands free.',
      ], products: ['chunky-knit-cardigan', 'metallic-leather-wristlet', 'ribbed-mini-dress'] }),
    article(5, { handle: 'caring-for-your-knitwear', title: 'Caring for your knitwear', by: 'emma', date: '2026-08-12', read_time: 5, views: 1530,
      cover: `${IMG}blog/cover-5.jpg`, tags: ['Care', 'Lifestyle'],
      excerpt: 'Wash less, fold more: the simple routine that keeps wool and alpaca soft for years.',
      body: [
        'Wool is naturally odour-resistant, so most knits only need airing between wears. When you do wash, use cold water and a wool detergent, and never wring.',
        'Dry flat on a towel, reshaping while damp. Hanging stretches the shoulders; folding keeps them perfect.',
        'Pilling is normal on soft fibres. A fabric comb removes it in a minute and makes an old favourite look new again.',
      ], products: ['forest-cable-knit-sweater', 'chunky-knit-cardigan'] }),
    article(6, { handle: 'soft-tailoring-is-here', title: 'Soft tailoring is here to stay', by: 'lina', date: '2026-07-26', read_time: 4, views: 640,
      cover: `${IMG}blog/cover-6.jpg`, tags: ['Fashion', 'Workwear'],
      excerpt: 'Relaxed blazers, fluid trousers and the end of the stiff office uniform.',
      body: [
        'The new tailoring is about movement. Fluid trousers with a pressed crease look sharp but feel like joggers, and unstructured blazers fold into a tote.',
        'Pair them with a fitted rib top or a simple tee — the contrast between relaxed and precise is what makes it feel modern.',
        'Neutral tones like stone, ecru and black mean every piece works together, which is the whole point of a capsule wardrobe.',
      ], products: ['tailored-wide-leg-trousers', 'vintage-logo-tee'] }),
  ];

  window.THEME = {
    key: 'chio',
    currency: 'USD',
    money_format: '${{amount}}',
    free_shipping_threshold: 15000,
    discount_codes: { WELCOME10: 10, CHIO15: 15, SAVE20: 20 },
    popular_searches: ['Hoodie', 'Dress', 'Boots', 'Knit', 'Trench', 'Linen'],
    products,
    collections,
    articles,
  };
})();
