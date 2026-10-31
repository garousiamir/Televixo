/*
 * Chio product reviews + Q&A (-> a reviews app / product metafields in Shopify).
 * ChioReviews.for(product) -> { reviews[], questions[], highlights[] } — hand-written for the hero product,
 * generated deterministically (seeded by handle) from type-aware pools for every other product.
 *
 * review: { id, name, avatar?, location, date (ISO), rating 1–5, quality, comfort, value (1–5), title, body,
 *           size, usual, height, fit (1 runs small · 3 true to size · 5 runs large), recommend, verified,
 *           photos[], helpful, unhelpful, pros[], cons[], reply?: { name, date, body } }
 * question: { id, name, date, question, answers: [{ name, staff, date, body }], helpful }
 */
(function () {
  const PR = 'assets/images/product/';
  const AV = 'assets/images/chio/';
  const PI = 'assets/images/chio/products/';

  const SWEAT = [
    { id: 'r1', name: 'Hizi M.', avatar: PR + 'review-hizi.jpg', location: 'Berlin, DE', date: '2026-10-08', rating: 5, quality: 5, comfort: 5, value: 4,
      title: 'The softest sweatshirt I own',
      body: 'I absolutely love this sweatshirt! The fabric feels soft and premium, the fit is relaxed without looking sloppy, and the colour looks exactly like the photos. It’s comfortable enough to wear all day while still looking put together. I’ve washed it three times now (cold, inside out) and the print still looks brand new.',
      size: 'S', usual: 'S', height: '5′3″–5′6″', fit: 4, recommend: true, verified: true,
      photos: [PR + 'gallery-1.jpg', PI + 'oversized-graphic-sweatshirt-2.jpg'], helpful: 234, unhelpful: 3,
      pros: ['oversized relaxed fit', 'long relaxed sleeves', 'heavyweight construction'], cons: [],
      reply: { name: 'Chio Studio', date: '2026-10-09', body: 'Thank you so much, Hizi! Washing cold and inside out is exactly what keeps the print crisp — we’re so glad it’s become a favourite.' } },
    { id: 'r2', name: 'Emma R.', avatar: PR + 'review-emma.jpg', location: 'London, UK', date: '2026-10-02', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Worth every penny',
      body: 'Heavy, cosy and the cobalt is even brighter in person. The dropped shoulder makes it look effortless with straight jeans. I sized down from M to S as suggested and it still has that slouchy look I wanted.',
      size: 'S', usual: 'M', height: '5′7″–5′10″', fit: 4, recommend: true, verified: true,
      photos: [PR + 'gallery-3.jpg'], helpful: 112, unhelpful: 2, pros: ['heavyweight construction', 'dropped shoulder design'], cons: [] },
    { id: 'r3', name: 'Millu K.', avatar: PR + 'review-millu.jpg', location: 'Vienna, AT', date: '2026-09-27', rating: 4, quality: 5, comfort: 4, value: 4,
      title: 'Great quality, sleeves are long',
      body: 'The quality is excellent and the brushed inside is so soft. Only note: the sleeves are really long on me (I’m 5′2″), so I push them up. If you’re petite, consider sizing down.',
      size: 'M', usual: 'M', height: 'Under 5′3″', fit: 5, recommend: true, verified: true,
      photos: [], helpful: 76, unhelpful: 4, pros: ['soft interior'], cons: ['long relaxed sleeves'] },
    { id: 'r4', name: 'Rosa B.', avatar: PR + 'review-rosa.jpg', location: 'Madrid, ES', date: '2026-09-21', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Colour is exactly as pictured',
      body: 'I was worried the blue would look different on screen, but it’s spot on — a true, saturated cobalt. Bought it for travelling and it has been on every flight since. Doesn’t wrinkle, doesn’t pill.',
      size: 'M', usual: 'M', height: '5′3″–5′6″', fit: 3, recommend: true, verified: true,
      photos: [PI + 'oversized-graphic-sweatshirt-1.jpg', PR + 'gallery-4.jpg', PR + 'gallery-2.jpg'], helpful: 68, unhelpful: 1, pros: ['oversized relaxed fit', 'minimal chest graphic'], cons: [] },
    { id: 'r5', name: 'Sofia L.', avatar: AV + 'avatar-2.jpg', location: 'Milan, IT', date: '2026-09-18', rating: 5, quality: 5, comfort: 5, value: 4,
      title: 'My weekend uniform',
      body: 'This is the kind of sweatshirt you reach for every Saturday. Thick but breathable, the ribbed hem sits nicely on the hip and doesn’t ride up. Already ordered the heather grey.',
      size: 'S', usual: 'S', height: '5′7″–5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 41, unhelpful: 0, pros: ['ribbed cuffs and hem'], cons: [] },
    { id: 'r6', name: 'Nora A.', location: 'Oslo, NO', date: '2026-09-12', rating: 4, quality: 4, comfort: 5, value: 4,
      title: 'Cosy, slightly shorter than expected',
      body: 'Lovely weight and very soft. It’s a bit shorter in the body than I expected from “oversized” — hits right at the hip on me. Perfect with high-waisted trousers, less so with leggings.',
      size: 'M', usual: 'M', height: 'Over 5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 29, unhelpful: 5, pros: ['soft interior'], cons: ['shorter body'] },
    { id: 'r7', name: 'Jade P.', avatar: AV + 'avatar-4.jpg', location: 'Paris, FR', date: '2026-09-08', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Feels like a designer piece',
      body: 'The structure of the fabric is what sells it — it holds its shape instead of collapsing like cheaper sweatshirts. The tiny chest graphic is subtle enough to wear to the office on a Friday.',
      size: 'XS', usual: 'S', height: 'Under 5′3″', fit: 4, recommend: true, verified: true,
      photos: [PR + 'gallery-5.jpg'], helpful: 37, unhelpful: 1, pros: ['heavyweight construction', 'minimal chest graphic'], cons: [] },
    { id: 'r8', name: 'Lea S.', location: 'Zürich, CH', date: '2026-09-03', rating: 3, quality: 4, comfort: 4, value: 2,
      title: 'Nice, but pricey for a sweatshirt',
      body: 'No complaints about the quality — it’s thick and well sewn. I just think the price is on the high side, and I wish it came in more colours. Would buy again on sale.',
      size: 'L', usual: 'L', height: '5′7″–5′10″', fit: 3, recommend: false, verified: true,
      photos: [], helpful: 18, unhelpful: 9, pros: ['heavyweight construction'], cons: ['price'],
      reply: { name: 'Chio Studio', date: '2026-09-04', body: 'Thanks for the honest feedback, Lea. Two new colours (forest and stone) arrive in November — subscribe to our newsletter for 10% off your first order.' } },
    { id: 'r9', name: 'Amira H.', avatar: AV + 'avatar-5.jpg', location: 'Dubai, AE', date: '2026-08-29', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Perfect oversized fit',
      body: 'True to size for an oversized look. I’m usually a medium and the M gives me that roomy, relaxed shape without drowning me. The shoulders drop just right.',
      size: 'M', usual: 'M', height: '5′3″–5′6″', fit: 3, recommend: true, verified: true,
      photos: [PI + 'oversized-graphic-sweatshirt-3.jpg'], helpful: 33, unhelpful: 0, pros: ['oversized relaxed fit', 'dropped shoulder design'], cons: [] },
    { id: 'r10', name: 'Clara W.', location: 'Hamburg, DE', date: '2026-08-24', rating: 4, quality: 4, comfort: 4, value: 4,
      title: 'Shrank a little in the dryer',
      body: 'My fault — I tumble dried it once and it lost about a centimetre in length. Still fits fine because it’s oversized. Follow the care label and you’ll be happy, the fabric itself is lovely.',
      size: 'L', usual: 'M', height: '5′7″–5′10″', fit: 4, recommend: true, verified: true,
      photos: [], helpful: 52, unhelpful: 2, pros: ['soft interior'], cons: ['shrinks slightly'] },
    { id: 'r11', name: 'Maya T.', avatar: AV + 'avatar-6.jpg', location: 'Amsterdam, NL', date: '2026-08-19', rating: 5, quality: 5, comfort: 5, value: 4,
      title: 'Bought two',
      body: 'Ordered one for me and ended up buying a second for my sister. Delivery took two days, packaging was plastic-free and there was a handwritten note. Small touches, big difference.',
      size: 'S', usual: 'S', height: '5′3″–5′6″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 24, unhelpful: 0, pros: [], cons: [] },
    { id: 'r12', name: 'Ines G.', location: 'Lisbon, PT', date: '2026-08-14', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Soft, warm and so easy to style',
      body: 'I wear it with a pleated mini skirt and loafers, or with joggers on the sofa. It’s warm enough for autumn evenings without a jacket. The cuffs keep the sleeves in place.',
      size: 'XS', usual: 'XS', height: 'Under 5′3″', fit: 4, recommend: true, verified: false,
      photos: [PR + 'gallery-2.jpg'], helpful: 15, unhelpful: 1, pros: ['ribbed cuffs and hem'], cons: [] },
    { id: 'r13', name: 'Hannah J.', avatar: AV + 'avatar-7.jpg', location: 'Dublin, IE', date: '2026-08-06', rating: 4, quality: 4, comfort: 5, value: 4,
      title: 'Lovely, a little warm indoors',
      body: 'Really well made and the colour is gorgeous. It’s quite heavy, so in a heated office I end up too warm — ideal for outdoors and cold flats though.',
      size: 'M', usual: 'M', height: '5′7″–5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 11, unhelpful: 1, pros: ['heavyweight construction'], cons: ['warm indoors'] },
    { id: 'r14', name: 'Yara N.', location: 'Copenhagen, DK', date: '2026-07-30', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Exactly what I was looking for',
      body: 'I’ve been searching for a heavyweight sweatshirt in a real blue — not navy, not baby blue — for ages. This is it. True to size, gorgeous drape, zero pilling after a month.',
      size: 'S', usual: 'S', height: '5′7″–5′10″', fit: 3, recommend: true, verified: true,
      photos: [PR + 'gallery-1.jpg'], helpful: 19, unhelpful: 0, pros: ['heavyweight construction'], cons: [] },
    { id: 'r15', name: 'Olivia F.', avatar: AV + 'avatar-8.jpg', location: 'Brooklyn, US', date: '2026-07-22', rating: 2, quality: 3, comfort: 4, value: 2,
      title: 'Too big for me',
      body: 'The fabric is nice but the fit was much too big — even the XS swallowed me. I returned it and the refund came through in four days, so at least that part was painless.',
      size: 'XS', usual: 'XS', height: 'Under 5′3″', fit: 5, recommend: false, verified: true,
      photos: [], helpful: 22, unhelpful: 6, pros: [], cons: ['oversized relaxed fit'],
      reply: { name: 'Chio Studio', date: '2026-07-23', body: 'Sorry it didn’t work out, Olivia. The cut is intentionally roomy — our petite customers love the Vintage Logo Tee for a closer fit. Glad the return was quick!' } },
    { id: 'r16', name: 'Lina K.', avatar: AV + 'avatar-3.jpg', location: 'Stockholm, SE', date: '2026-07-15', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Holds its colour beautifully',
      body: 'Ten washes in and the cobalt hasn’t faded at all. Garment dyeing makes such a difference. It still looks crisp enough to wear with a trench for work.',
      size: 'M', usual: 'M', height: '5′7″–5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 27, unhelpful: 0, pros: [], cons: [] },
    { id: 'r17', name: 'Priya D.', location: 'Toronto, CA', date: '2026-07-08', rating: 4, quality: 4, comfort: 4, value: 5,
      title: 'Great value for the quality',
      body: 'Compared to similar sweatshirts from bigger brands this is thicker and better finished, for less. Docked one star only because the neckline is a touch tight going over my head.',
      size: 'L', usual: 'L', height: '5′3″–5′6″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 9, unhelpful: 1, pros: ['heavyweight construction'], cons: ['snug neckline'] },
    { id: 'r18', name: 'Zoe M.', avatar: AV + 'avatar-9.jpg', location: 'Sydney, AU', date: '2026-06-30', rating: 5, quality: 5, comfort: 5, value: 4,
      title: 'Cloud-soft inside',
      body: 'The brushed interior is unreal. It feels like wearing a blanket but looks neat from the outside. Shipping to Australia took six days, which I thought was fast.',
      size: 'S', usual: 'S', height: '5′3″–5′6″', fit: 4, recommend: true, verified: true,
      photos: [PI + 'oversized-graphic-sweatshirt-2.jpg'], helpful: 14, unhelpful: 0, pros: ['soft interior'], cons: [] },
    { id: 'r19', name: 'Camille R.', location: 'Lyon, FR', date: '2026-06-21', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Gift that was a hit',
      body: 'Bought it for my daughter’s birthday and she hasn’t taken it off. Arrived beautifully wrapped. Size guide was accurate.',
      size: 'M', usual: 'M', height: '5′7″–5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 6, unhelpful: 0, pros: [], cons: [] },
    { id: 'r20', name: 'Eva Z.', avatar: AV + 'avatar-1.jpg', location: 'Prague, CZ', date: '2026-06-12', rating: 4, quality: 5, comfort: 4, value: 3,
      title: 'Beautiful, runs slightly large',
      body: 'Gorgeous colour and quality. Runs a little large even for an oversized cut — I’m between S and M and the S was perfect. The print is subtle and well placed.',
      size: 'S', usual: 'M', height: '5′3″–5′6″', fit: 4, recommend: true, verified: true,
      photos: [], helpful: 12, unhelpful: 2, pros: ['minimal chest graphic'], cons: [] },
    { id: 'r21', name: 'Tess O.', location: 'Edinburgh, UK', date: '2026-05-28', rating: 5, quality: 5, comfort: 5, value: 5,
      title: 'Ten out of ten',
      body: 'Quality, colour, fit — all perfect. It’s now the first thing I pack for every trip. Would love a matching jogger in the same blue!',
      size: 'L', usual: 'L', height: 'Over 5′10″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 8, unhelpful: 0, pros: [], cons: [] },
    { id: 'r22', name: 'Mia C.', avatar: AV + 'avatar-5.jpg', location: 'Barcelona, ES', date: '2026-05-16', rating: 4, quality: 4, comfort: 5, value: 4,
      title: 'Comfy and well made',
      body: 'Super comfortable and the stitching is very neat. I took one star off because the colour bled a little on its first wash — wash it separately the first time and you’re fine.',
      size: 'M', usual: 'M', height: '5′3″–5′6″', fit: 3, recommend: true, verified: true,
      photos: [], helpful: 10, unhelpful: 1, pros: ['soft interior'], cons: ['first wash'] },
  ];

  const SWEAT_Q = [
    { id: 'q1', name: 'Anna', date: '2026-10-03', helpful: 18, question: 'I’m 5′5″ and usually wear a small. Should I size down for a less oversized look?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-10-03', body: 'For a closer fit we recommend going one size down — the XS still has a relaxed shoulder but sits closer at the hip. Our model is 5′9″ and wears S.' }] },
    { id: 'q2', name: 'Marco', date: '2026-09-25', helpful: 11, question: 'Is the chest graphic printed or embroidered?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-09-25', body: 'It’s a water-based screen print that’s cured into the fabric, so it stays soft and flexible and won’t crack when washed inside out.' }] },
    { id: 'q3', name: 'Julia', date: '2026-09-14', helpful: 9, question: 'Does it shrink after washing?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-09-14', body: 'The fabric is pre-shrunk. Washed cold and dried flat it keeps its size; tumble drying can take off up to 1–2%.' },
        { name: 'Clara W.', staff: false, date: '2026-09-16', body: 'Mine shrank a tiny bit when I tumble dried it once — air dry and it’s perfect.' }] },
    { id: 'q4', name: 'Sam', date: '2026-08-30', helpful: 6, question: 'Is the blue closer to royal blue or navy?',
      answers: [{ name: 'Rosa B.', staff: false, date: '2026-09-01', body: 'Definitely royal/cobalt — bright and saturated, exactly like the photos. Not navy at all.' }] },
    { id: 'q5', name: 'Leonie', date: '2026-08-12', helpful: 4, question: 'Will the heather grey colour come back in XXL?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-08-12', body: 'Yes! XXL is restocking in all colours at the start of November. Tap “Notify me” on the size and we’ll email you the moment it lands.' }] },
  ];

  const SWEAT_H = [
    { label: 'Soft fabric', count: 42, q: 'soft' }, { label: 'True to size', count: 31, q: 'true to size' },
    { label: 'Colour as pictured', count: 27, q: 'colour' }, { label: 'Heavyweight feel', count: 22, q: 'heavy' },
    { label: 'Long sleeves', count: 9, q: 'sleeves' }, { label: 'Shrinks if tumble dried', count: 6, q: 'shrank', neg: true },
  ];

  /* ---------- generic, type-aware review generator ---------- */
  const NAMES = [['Sara P.', AV + 'avatar-2.jpg', 'Munich, DE'], ['Chloé B.', null, 'Bordeaux, FR'], ['Isla M.', AV + 'avatar-4.jpg', 'Glasgow, UK'],
    ['Freya L.', null, 'Bergen, NO'], ['Martina V.', AV + 'avatar-6.jpg', 'Turin, IT'], ['Ava K.', AV + 'avatar-7.jpg', 'Chicago, US'],
    ['Noor S.', null, 'Rotterdam, NL'], ['Elena R.', AV + 'avatar-8.jpg', 'Valencia, ES'], ['Kaia T.', null, 'Tallinn, EE'],
    ['Lucía G.', AV + 'avatar-3.jpg', 'Seville, ES'], ['Ella D.', null, 'Melbourne, AU'], ['Mila H.', AV + 'avatar-9.jpg', 'Antwerp, BE']];
  const POOLS = {
    apparel: [
      [5, 'Instant favourite', 'The fabric feels premium and the cut is really flattering. I’ve worn it three times this week already and got compliments every time.'],
      [5, 'Exactly as pictured', 'Colour and fit are exactly like the photos. Packaging was lovely and it arrived in two days.'],
      [4, 'Lovely quality, check the size guide', 'Beautifully made with neat seams. It runs a touch big, so I’m glad I checked the measurements before ordering.'],
      [5, 'So comfortable', 'Comfortable enough to wear all day while still looking polished. It washes well too — no pilling so far.'],
      [4, 'Great everyday piece', 'Easy to style with jeans or trousers. The material is soft and breathable. Would love more colours.'],
      [3, 'Nice but not perfect', 'Good quality overall, but the fit wasn’t quite right on my frame. Customer service helped me exchange it quickly.'],
      [5, 'Worth it', 'You can feel the difference in quality compared to fast fashion. This will last for years.'],
      [5, 'Perfect for travel', 'Doesn’t crease, layers nicely and looks put together straight out of a suitcase.'],
    ],
    shoes: [
      [5, 'Comfortable from day one', 'No break-in needed — I walked around the city all day in them. The suede is soft and the colour is gorgeous.'],
      [4, 'Beautiful, size up if between', 'Gorgeous boots. They’re a little narrow, so if you’re between sizes take the larger one.'],
      [5, 'Exactly as pictured', 'The heel height is perfect for everyday. They go with dresses and wide-leg trousers alike.'],
      [5, 'Great quality', 'Leather lining, solid sole, neat stitching. These feel like they’ll last many seasons.'],
      [3, 'Pretty but stiff at first', 'They took a couple of wears to soften up around the ankle. Now they’re fine, but be patient.'],
      [5, 'Compliments everywhere', 'Everyone asks where they’re from. Use a suede spray before the first wear and they stay perfect.'],
    ],
    bag: [
      [5, 'Small but fits everything', 'Phone, cards, keys and a lipstick — exactly what I need for an evening out. The metallic finish is beautiful.'],
      [5, 'Gorgeous finish', 'The leather is soft and the colour catches the light so nicely. Feels far more expensive than it is.'],
      [4, 'Lovely, strap is short', 'Beautifully made. The wrist strap is a little short for bigger hands, but I love it.'],
      [5, 'Perfect gift', 'Bought it as a gift and it arrived in a lovely dust bag. She uses it every weekend.'],
      [4, 'Great quality', 'Solid zip, neat edges, good weight. Would buy in black too.'],
    ],
  };
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const HEIGHTS = ['Under 5′3″', '5′3″–5′6″', '5′7″–5′10″', 'Over 5′10″'];

  function generate(p) {
    const r = rng(hash(p.handle));
    const fam = p.type === 'Bag' ? 'bag' : (p.type === 'Boots' ? 'shoes' : 'apparel');
    const pool = POOLS[fam];
    const sizes = (p.options.find((o) => o.name === 'Size') || { values: [] }).values;
    const n = 6 + Math.floor(r() * 5);
    const start = new Date('2026-10-10');
    const out = [];
    for (let i = 0; i < n; i++) {
      const [rating, title, body] = pool[(i + Math.floor(r() * pool.length)) % pool.length];
      const who = NAMES[(hash(p.handle + i) + i) % NAMES.length];
      const d = new Date(start); d.setDate(d.getDate() - Math.floor(i * 9 + r() * 8));
      const size = sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(r() * sizes.length))] : null;
      const sub = (b) => Math.max(1, Math.min(5, rating + b));
      out.push({ id: `${p.handle}-${i}`, name: who[0], avatar: who[1], location: who[2], date: d.toISOString().slice(0, 10),
        rating, quality: sub(r() > 0.7 ? -1 : 0), comfort: sub(r() > 0.75 ? -1 : 0), value: sub(r() > 0.6 ? -1 : 0), title, body,
        size, usual: size, height: fam === 'bag' ? null : HEIGHTS[Math.floor(r() * 4)], fit: fam === 'bag' ? null : (r() > 0.7 ? 4 : 3),
        recommend: rating >= 4, verified: r() > 0.12, photos: i % 3 === 0 ? [p.images[i % p.images.length]] : [],
        helpful: Math.floor(r() * 40), unhelpful: Math.floor(r() * 4), pros: [], cons: [],
        reply: rating <= 3 ? { name: 'Chio Studio', date: d.toISOString().slice(0, 10), body: 'Thank you for the honest feedback — we’ve shared it with our design team. Our customer care team is always happy to help with an exchange.' } : null });
    }
    return out;
  }
  const genericQ = (p) => [
    { id: `${p.handle}-q1`, name: 'Hanna', date: '2026-09-20', helpful: 5, question: p.type === 'Bag' ? 'Does it fit a large phone?' : 'Does this run true to size?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-09-20', body: p.type === 'Bag' ? 'Yes — it fits phones up to 6.7″ plus cards and keys.' : `Most customers find it true to size. ${p.fit ? 'Fit: ' + p.fit + '.' : ''} Check the size guide for exact measurements.` }] },
    { id: `${p.handle}-q2`, name: 'Leo', date: '2026-08-28', helpful: 2, question: 'How long does delivery take?',
      answers: [{ name: 'Chio Studio', staff: true, date: '2026-08-28', body: 'Orders placed before 3pm ship the same day. Standard delivery takes 2–4 business days and is free over $150.' }] },
  ];
  const genericH = (p) => {
    const base = p.type === 'Bag' ? ['Beautiful finish', 'Fits essentials', 'Great gift'] : p.type === 'Boots' ? ['Comfortable', 'Soft suede', 'Versatile'] : ['Great quality', 'True to size', 'Soft fabric'];
    return base.map((l, i) => ({ label: l, count: 14 - i * 4, q: l.split(' ').pop().toLowerCase() }));
  };

  window.ChioReviews = {
    for(p) {
      if (!p) return { reviews: [], questions: [], highlights: [] };
      if (p.handle === 'oversized-graphic-sweatshirt') return { reviews: SWEAT, questions: SWEAT_Q, highlights: SWEAT_H, summary: 'Shoppers love the soft, brushed fleece, the heavyweight feel and a cobalt that looks exactly like the photos. The cut is roomy — petite customers often size down — and a few say it shrinks slightly if tumble dried.' };
      return { reviews: generate(p), questions: genericQ(p), highlights: genericH(p) };
    },
    HEIGHTS,
  };
})();
