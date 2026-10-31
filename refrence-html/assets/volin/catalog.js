/*
 * Volin catalog (static stand-in for Shopify product / collection / article objects).
 * Shape documented in assets/js/store.js. Money is in cents. Load BEFORE assets/js/store.js.
 *
 * Extra (non-Ajax-API) fields used by Volin templates:
 *   product.subtitle        small uppercase eyebrow ("Vintage washed")      -> product metafield
 *   product.details[]       bullet list for the product page              -> product metafield
 *   product.material / care                                               -> product metafields
 *   option.swatches         { "Black": "#313131" } for the Color option    -> swatch metafield / color option
 *   collection.products_count, collection.image, collection.url
 *   article.*               see ARTICLES below (blog.articles in Liquid)
 */
(function () {
  const IMG = 'assets/images/volin/';
  const P = (f) => IMG + 'products/' + f;
  const I = (f) => IMG + f;
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const C = {
    black: ['Black', '#313131'], navy: ['Navy', '#5e688d'], sky: ['Sky', '#9fa7c4'], green: ['Green', '#16d794'],
    blue: ['Blue', '#103eca'], sand: ['Sand', '#d8cbb8'], cream: ['Cream', '#efe9dd'], olive: ['Olive', '#5b5f3e'],
    indigo: ['Indigo', '#1f2638'], tobacco: ['Tobacco', '#a07a52'], white: ['White', '#f4f4f2'], stone: ['Stone', '#bdb6ab'],
    charcoal: ['Charcoal', '#4a4a4a'], brown: ['Brown', '#6b4a33'],
  };

  // Build a Shopify-like product with Size x Color variants (ids are deterministic: product.id * 100 + n).
  function product(id, d) {
    const sizes = d.sizes || SIZES;
    const colors = d.colors;
    const soldOut = d.soldOut || []; // entries like 'XXL' or 'XS/Black'
    const options = [
      { name: 'Size', values: sizes },
      { name: 'Color', values: colors.map((c) => c[0]), swatches: Object.fromEntries(colors) },
    ];
    const variants = [];
    colors.forEach(([color]) => sizes.forEach((size) => {
      const n = variants.length + 1;
      variants.push({
        id: id * 100 + n, title: `${size} / ${color}`, options: [size, color], sku: `VL-${id}-${size}-${color.slice(0, 3).toUpperCase()}`,
        price: d.price, compare_at_price: d.compare || null,
        available: !soldOut.includes(size) && !soldOut.includes(`${size}/${color}`),
      });
    }));
    return {
      id, handle: d.handle, title: d.title, vendor: 'Volin', type: d.type, tags: d.tags || [],
      subtitle: d.subtitle || '', price: d.price, compare_at_price: d.compare || null,
      available: variants.some((v) => v.available), rating: d.rating ?? 4, rating_count: d.reviews ?? 24,
      featured_image: d.images[0], images: d.images, options, variants, collections: d.collections,
      description: d.description, details: d.details || [], material: d.material || '', care: d.care || '',
      url: `volin-product.html?handle=${d.handle}`,
    };
  }

  const PRODUCTS = [
    product(1, {
      handle: 'core-zip-hoodie', title: 'Core Zip Hoodie', type: 'Hoodies', subtitle: 'Vintage washed',
      price: 2300, compare: 3600, rating: 4, reviews: 128, colors: [C.green, C.blue, C.black], soldOut: ['XXL/Blue'],
      images: [I('featured.webp'), I('amazing-hoodie.jpg'), P('beige-hoodie.jpg'), I('cat-hoodie.jpg')],
      collections: ['hoodies', 'sale', 'new-in'], tags: ['hoodies', 'vintage washed', 'bestseller', 'sale'],
      description: 'Crafted from premium heavyweight cotton with a relaxed oversized silhouette. Designed for everyday comfort, durability, and timeless minimal style.',
      details: ['Heavyweight 420 gsm brushed-back fleece', 'Two-way metal zip, ribbed cuffs and hem', 'Relaxed oversized fit – size down for a closer fit', 'Garment-dyed and vintage washed'],
      material: '100% organic cotton', care: 'Machine wash cold, inside out. Do not tumble dry.',
    }),
    product(2, {
      handle: 'black-t-shirt-with-wallet', title: 'Black T-Shirt with Wallet', type: 'T-Shirts', subtitle: 'Gift set',
      price: 2300, compare: 3600, rating: 4, reviews: 86, colors: [C.black, C.navy, C.sky],
      images: [I('offer-tshirt.jpg'), P('black-tee.jpg'), I('featured.webp'), I('cat-tshirt.jpg')],
      collections: ['t-shirts', 'wallet', 'sale'], tags: ['t-shirts', 'wallet', 'gift', 'sale'],
      description: 'Our boxy heavyweight tee paired with a slim leather card wallet. The everyday uniform, boxed and ready to gift.',
      details: ['240 gsm combed cotton jersey', 'Dropped shoulder, boxy fit', 'Full-grain leather card wallet, 4 slots'],
      material: 'Tee: 100% cotton. Wallet: full-grain leather', care: 'Wash tee at 30°C. Wipe wallet clean.',
    }),
    product(3, {
      handle: 'utility-cargo-pants', title: 'Utility Cargo Pants', type: 'Pants', subtitle: 'Garment dyed',
      price: 2300, compare: 3600, rating: 4, reviews: 54, colors: [C.olive, C.black, C.stone], soldOut: ['XS/Stone'],
      images: [I('offer-pants.jpg'), P('olive-cargo.jpg')],
      collections: ['pants', 'sale', 'new-in'], tags: ['pants', 'cargo', 'new', 'sale'],
      description: 'Relaxed cargo trousers in a sturdy cotton twill with bellow pockets and an adjustable hem.',
      details: ['Midweight cotton twill', 'Bellow cargo pockets with snap flaps', 'Drawcord hem', 'Relaxed straight leg'],
      material: '100% cotton twill', care: 'Machine wash cold. Line dry.',
    }),
    product(4, {
      handle: 'court-leather-sneakers', title: 'Court Leather Sneakers', type: 'Shoes', subtitle: 'Full-grain leather',
      price: 2300, compare: 3600, rating: 4, reviews: 212, colors: [C.white, C.black],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      images: [I('offer-sneakers.jpg'), P('white-sneakers.jpg'), I('cat-sneakers.jpg')],
      collections: ['shoes', 'sale'], tags: ['shoes', 'sneakers', 'leather', 'sale'],
      description: 'A clean low-top court sneaker in full-grain leather on a cushioned cupsole. Goes with everything.',
      details: ['Full-grain leather upper', 'Leather lining, removable insole', 'Stitched rubber cupsole'],
      material: 'Leather upper, rubber sole', care: 'Wipe with a damp cloth. Use leather conditioner.',
    }),
    product(5, {
      handle: 'cream-crew-sweater', title: 'Cream Crew Sweater', type: 'Sweaters', subtitle: 'Loopback cotton',
      price: 2300, compare: 3600, rating: 5, reviews: 41, colors: [C.cream, C.sand, C.charcoal],
      images: [I('offer-sweater.jpg'), P('cream-sweater.jpg')],
      collections: ['hoodies', 'sale'], tags: ['sweatshirt', 'crewneck', 'sale'],
      description: 'A loopback cotton crewneck with a soft hand-feel, ribbed trims and a relaxed fit.',
      details: ['380 gsm loopback cotton', 'Ribbed collar, cuffs and hem', 'Relaxed fit'],
      material: '100% cotton', care: 'Machine wash cold. Reshape and dry flat.',
    }),
    product(6, {
      handle: 'essential-pullover-hoodie', title: 'Essential Pullover Hoodie', type: 'Hoodies', subtitle: 'Brushed fleece',
      price: 7400, compare: 8900, rating: 5, reviews: 167, colors: [C.sand, C.black, C.charcoal],
      images: [I('cat-hoodie.jpg'), P('beige-hoodie.jpg'), I('amazing-hoodie-m.jpg')],
      collections: ['hoodies', 'new-in'], tags: ['hoodies', 'new', 'bestseller'],
      description: 'Our signature pullover hoodie with a double-layered hood and a brushed interior that only gets softer.',
      details: ['450 gsm brushed fleece', 'Double-layered hood, no drawcords', 'Kangaroo pocket'],
      material: '80% cotton, 20% recycled polyester', care: 'Machine wash cold, inside out.',
    }),
    product(7, {
      handle: 'heavyweight-boxy-tee', title: 'Heavyweight Boxy Tee', type: 'T-Shirts', subtitle: '240 gsm cotton',
      price: 3400, rating: 4, reviews: 302, colors: [C.black, C.white, C.stone],
      images: [I('cat-tshirt.jpg'), P('black-tee.jpg')],
      collections: ['t-shirts'], tags: ['t-shirts', 'bestseller', 'essentials'],
      description: 'A structured, boxy tee cut from dense combed cotton with a tight ribbed neckline.',
      details: ['240 gsm combed cotton', 'Boxy fit, dropped shoulder', 'Pre-shrunk'],
      material: '100% combed cotton', care: 'Machine wash at 30°C.',
    }),
    product(8, {
      handle: 'classic-low-top-sneakers', title: 'Classic Low-Top Sneakers', type: 'Shoes', subtitle: 'Everyday court',
      price: 9800, compare: 12000, rating: 4, reviews: 77, colors: [C.white, C.stone],
      images: [I('cat-sneakers.jpg'), P('white-sneakers.jpg'), I('offer-sneakers.jpg')],
      collections: ['shoes', 'sale'], tags: ['shoes', 'sneakers', 'sale'], soldOut: ['XXL'],
      description: 'Minimal low-top sneakers with tonal laces and a padded collar for all-day comfort.',
      details: ['Nappa leather upper', 'Padded collar and tongue', 'Margom-style rubber sole'],
      material: 'Leather upper, rubber sole', care: 'Wipe clean.',
    }),
    product(9, {
      handle: 'raw-selvedge-jeans', title: 'Raw Selvedge Jeans', type: 'Pants', subtitle: '14 oz denim',
      price: 8900, rating: 5, reviews: 63, colors: [C.indigo, C.black],
      images: [I('cat-jeans.jpg'), P('dark-jeans.jpg')],
      collections: ['pants', 'new-in'], tags: ['pants', 'denim', 'new'],
      description: 'Straight-leg jeans in rigid 14 oz Japanese selvedge denim that fades with you.',
      details: ['14 oz Japanese selvedge denim', 'Button fly, copper rivets', 'Straight leg, mid rise'],
      material: '100% cotton denim', care: 'Wash rarely, cold and inside out.',
    }),
    product(10, {
      handle: 'nylon-bomber-jacket', title: 'Nylon Bomber Jacket', type: 'Jacket', subtitle: 'Water repellent',
      price: 12900, compare: 15900, rating: 4, reviews: 39, colors: [C.black, C.olive],
      images: [I('cat-jacket.jpg'), P('black-bomber.jpg')],
      collections: ['jacket', 'sale'], tags: ['jacket', 'bomber', 'outerwear', 'sale'],
      description: 'A lightweight padded bomber in water-repellent nylon with ribbed collar, cuffs and hem.',
      details: ['Water-repellent recycled nylon shell', 'Lightly padded', 'Two-way metal zip'],
      material: '100% recycled nylon', care: 'Machine wash cold, gentle cycle.',
    }),
    product(11, {
      handle: 'twill-over-jacket', title: 'Twill Over Jacket', type: 'Over Jacket', subtitle: 'Brushed twill',
      price: 9400, rating: 4, reviews: 22, colors: [C.tobacco, C.olive, C.black],
      images: [I('cat-shirt.jpg'), P('brown-overshirt.jpg')],
      collections: ['over-jacket', 'new-in'], tags: ['overshirt', 'outerwear', 'new'],
      description: 'A brushed twill overshirt with twin flap pockets – layer it as a light jacket or wear it on its own.',
      details: ['Brushed cotton twill', 'Twin flap chest pockets', 'Horn-effect buttons'],
      material: '100% cotton', care: 'Machine wash cold.',
    }),
    product(12, {
      handle: 'washed-sand-hoodie', title: 'Washed Sand Hoodie', type: 'Hoodies', subtitle: 'Summer offer',
      price: 6900, compare: 8600, rating: 4, reviews: 58, colors: [C.sand, C.stone],
      images: [I('amazing-hoodie.jpg'), I('amazing-hoodie-m.jpg'), P('beige-hoodie.jpg')],
      collections: ['hoodies', 'sale'], tags: ['hoodies', 'sale'],
      description: 'A sun-faded sand hoodie in midweight fleece. Folded, stacked and ready for summer evenings.',
      details: ['Midweight 330 gsm fleece', 'Enzyme washed', 'Relaxed fit'],
      material: '100% cotton', care: 'Machine wash cold.',
    }),
    product(13, {
      handle: 'slim-leather-wallet', title: 'Slim Leather Wallet', type: 'Wallet', subtitle: 'Full-grain leather',
      price: 3900, rating: 5, reviews: 95, sizes: ['One size'], colors: [C.black, C.brown],
      images: [I('featured.webp'), I('offer-tshirt.jpg')],
      collections: ['wallet'], tags: ['wallet', 'accessories', 'leather'],
      description: 'A minimal card wallet in full-grain leather with four slots and a centre pocket for notes.',
      details: ['Full-grain vegetable-tanned leather', '4 card slots + note pocket', 'Hand-burnished edges'],
      material: 'Full-grain leather', care: 'Wipe clean, condition occasionally.',
    }),
    product(14, {
      handle: 'merino-crew-tee', title: 'Merino Crew Tee', type: 'T-Shirts', subtitle: 'Fine merino',
      price: 5200, rating: 4, reviews: 18, colors: [C.black, C.navy], soldOut: ['XS', 'XXL/Navy'],
      images: [P('black-tee.jpg'), I('cat-tshirt.jpg')],
      collections: ['t-shirts', 'new-in'], tags: ['t-shirts', 'merino', 'new'],
      description: 'Temperature-regulating fine merino tee that stays fresh for days. Travel-ready essential.',
      details: ['170 gsm fine merino jersey', 'Odour resistant', 'Regular fit'],
      material: '100% merino wool', care: 'Hand wash cold. Dry flat.',
    }),
    product(15, {
      handle: 'ripstop-cargo-trousers', title: 'Ripstop Cargo Trousers', type: 'Pants', subtitle: 'Technical ripstop',
      price: 7900, compare: 9900, rating: 4, reviews: 31, colors: [C.olive, C.black],
      images: [P('olive-cargo.jpg'), I('offer-pants.jpg')],
      collections: ['pants', 'sale'], tags: ['pants', 'cargo', 'sale'],
      description: 'Lightweight ripstop trousers with articulated knees and hidden-snap cargo pockets.',
      details: ['Cotton-nylon ripstop', 'Articulated knees', 'Elastic back waist with belt loops'],
      material: '60% cotton, 40% nylon', care: 'Machine wash cold.',
    }),
    product(16, {
      handle: 'harrington-over-jacket', title: 'Harrington Over Jacket', type: 'Over Jacket', subtitle: 'Waxed cotton',
      price: 13900, rating: 5, reviews: 12, colors: [C.black, C.tobacco],
      images: [P('black-bomber.jpg'), I('cat-jacket.jpg')],
      collections: ['over-jacket', 'jacket', 'new-in'], tags: ['jacket', 'outerwear', 'new'],
      description: 'A modern Harrington in waxed cotton with a tartan-free clean lining and a ribbed collar.',
      details: ['Waxed cotton shell', 'Ribbed collar, cuffs and hem', 'Two-way metal zip'],
      material: '100% cotton, paraffin wax finish', care: 'Spot clean only. Re-wax yearly.',
    }),
    product(17, {
      handle: 'off-white-knit-crew', title: 'Off-White Knit Crew', type: 'Sweaters', subtitle: 'Cotton-cashmere',
      price: 11800, rating: 5, reviews: 9, colors: [C.cream, C.stone],
      images: [P('cream-sweater.jpg'), I('offer-sweater.jpg')],
      collections: ['new-in'], tags: ['knitwear', 'new'],
      description: 'A soft cotton-cashmere crewneck with a fully-fashioned knit and a relaxed drape.',
      details: ['85% cotton, 15% cashmere', '12-gauge knit', 'Relaxed fit'],
      material: '85% cotton, 15% cashmere', care: 'Hand wash cold. Dry flat.',
    }),
  ];

  const COLLECTIONS = [
    ['shoes', 'Shoes', 'Clean leather sneakers built on durable cupsoles.', I('cat-sneakers.jpg')],
    ['t-shirts', 'T-Shirts', 'Heavyweight and merino tees – the foundation of every outfit.', I('cat-tshirt.jpg')],
    ['pants', 'Pants', 'Cargos, denim and relaxed trousers.', I('cat-jeans.jpg')],
    ['wallet', 'Wallet', 'Full-grain leather small goods.', I('featured.webp')],
    ['jacket', 'Jacket', 'Bombers and light outerwear.', I('cat-jacket.jpg')],
    ['hoodies', 'Hoodies', 'Brushed fleece hoodies and crewnecks.', I('cat-hoodie.jpg')],
    ['over-jacket', 'Over Jacket', 'Overshirts and layering jackets.', I('cat-shirt.jpg')],
    ['new-in', 'New In', 'The latest drops from the studio.', P('beige-hoodie.jpg')],
    ['sale', 'Sale', 'Limited-time offers on essentials.', I('offer-pants.jpg')],
  ].map(([handle, title, description, image], i) => ({
    id: i + 1, handle, title, description, image,
    url: `volin-shop.html?collection=${handle}`,
    products_count: PRODUCTS.filter((p) => p.collections.includes(handle)).length,
  }));

  const body = (...p) => p;
  const ARTICLES = [
    {
      id: 1, handle: 'how-to-style-t-shirts', title: 'How to style t - shirts?', date: '8 July 2028', published_at: '2028-07-08',
      author: 'Ethan Carter', avatar: I('blog-avatar.jpg'), image: I('blog-crop.jpg'), image_wide: I('blog.jpg'),
      reading_time: '6 min', views: 392, tags: ['t-shirts', 'styling'],
      excerpt: 'Discover how to master the smart casual dress code with timeless wardrobe essentials, modern styling tips, and versatile outfit combinations that work for every occasion.',
      body: body(
        'A great t-shirt is the most honest piece in your wardrobe. It shows fit, fabric and proportion with nothing to hide behind – which is exactly why getting it right changes everything else you wear.',
        'Start with weight. A 220–260 gsm cotton jersey drapes cleanly, keeps its shape after washing and reads as intentional rather than underwear. Pair a boxy heavyweight tee with straight-leg denim and clean leather sneakers for the simplest smart-casual uniform there is.',
        'Next, think in layers. An open overshirt or a light bomber turns the same tee into an evening look; a tucked tee with pleated trousers and a slim belt works for the office.',
        'Finally, keep the palette tight. Black, off-white, stone and olive all speak to each other, so every piece you add multiplies the outfits you already own.',
      ),
    },
    {
      id: 2, handle: 'building-a-capsule-wardrobe', title: 'Capsule wardrobe 101', date: '2 June 2026', published_at: '2026-06-02',
      author: 'Ethan Carter', avatar: I('blog-avatar.jpg'), image: I('blog.jpg'), image_wide: I('blog.jpg'),
      reading_time: '8 min', views: 1204, tags: ['hoodies', 'essentials'],
      excerpt: 'Twelve pieces, endless combinations. How to choose essentials that work together and last for years.',
      body: body(
        'A capsule wardrobe is not about owning less for the sake of it – it is about owning pieces that all work together.',
        'Begin with the foundations: two heavyweight tees, one hoodie, one knit, straight denim, a cargo trouser, a light jacket and one pair of clean sneakers.',
        'Choose a neutral base and add one accent colour. Every new piece should pair with at least three things you already own.',
      ),
    },
    {
      id: 3, handle: 'caring-for-heavyweight-cotton', title: 'Caring for cotton', date: '18 May 2026', published_at: '2026-05-18',
      author: 'Mia Novak', avatar: I('review-avatar.jpg'), image: I('amazing-hoodie.jpg'), image_wide: I('amazing-hoodie.jpg'),
      reading_time: '4 min', views: 640, tags: ['hoodies', 'care'],
      excerpt: 'Wash cold, dry flat and your favourite hoodie will look better in year three than on day one.',
      body: body(
        'Heavyweight cotton is built to last, but heat is its enemy. Wash cold and inside out to protect the colour and surface.',
        'Skip the tumble dryer – reshape while damp and dry flat. Your fleece will stay plush and the fit will not shrink.',
        'Store knits and fleece folded rather than hung to keep shoulders sharp.',
      ),
    },
    {
      id: 4, handle: 'the-perfect-white-sneaker', title: 'The white sneaker', date: '30 April 2026', published_at: '2026-04-30',
      author: 'Ethan Carter', avatar: I('blog-avatar.jpg'), image: I('cat-sneakers.jpg'), image_wide: I('offer-sneakers.jpg'),
      reading_time: '5 min', views: 2310, tags: ['shoes', 'guides'],
      excerpt: 'Leather, construction and sole: what separates a sneaker that lasts from one that creases in a week.',
      body: body(
        'Look for full-grain leather – it creases softly and can be conditioned. Corrected-grain leather cracks.',
        'A stitched cupsole can be resoled and holds its shape far longer than a glued one.',
        'Keep them clean with a damp cloth after every few wears and a leather balm once a month.',
      ),
    },
    {
      id: 5, handle: 'layering-for-autumn', title: 'Layering for autumn', date: '12 April 2026', published_at: '2026-04-12',
      author: 'Mia Novak', avatar: I('review-avatar.jpg'), image: I('cat-jacket.jpg'), image_wide: I('cat-jacket.jpg'),
      reading_time: '6 min', views: 870, tags: ['jacket', 'over-jacket', 'styling'],
      excerpt: 'From tee to overshirt to bomber: a simple three-layer system for unpredictable weather.',
      body: body(
        'Think base, mid and shell. A tee as base, an overshirt or knit as mid layer and a bomber as shell.',
        'Each layer should work on its own, so you can peel back as the day warms up.',
        'Keep textures varied – jersey, twill and nylon – so the outfit reads rich even in one colour.',
      ),
    },
    {
      id: 6, handle: 'denim-fit-guide', title: 'Denim fit guide', date: '28 March 2026', published_at: '2026-03-28',
      author: 'Ethan Carter', avatar: I('blog-avatar.jpg'), image: I('cat-jeans.jpg'), image_wide: I('cat-jeans.jpg'),
      reading_time: '7 min', views: 515, tags: ['pants', 'guides'],
      excerpt: 'Rise, leg opening and break explained – find the straight-leg jean that works for your build.',
      body: body(
        'Rise sets the tone: a mid rise sits at the hip and pairs with both tucked and untucked tops.',
        'A straight leg with a 19–20 cm opening balances chunky sneakers without flaring.',
        'Raw denim stretches about half a size in the waist – buy snug and let it mould to you.',
      ),
    },
  ].map((a) => ({ ...a, url: `volin-article.html?id=${a.id}` }));

  window.THEME = {
    key: 'volin',
    currency: 'USD',
    money_format: '${{amount}}',
    free_shipping_threshold: 15000,
    discount_codes: { WELCOME10: 10, VOLIN15: 15, ESSENTIALS20: 20 },
    products: PRODUCTS,
    collections: COLLECTIONS,
    articles: ARTICLES,
    popular_searches: ['hoodie', 'cargo', 'sneakers', 't-shirt', 'jacket', 'wallet'],
  };
})();
