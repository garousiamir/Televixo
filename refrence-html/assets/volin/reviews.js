/*
 * Volin product reviews + Q&A (static stand-in for a reviews app such as Judge.me / Okendo / Shopify Product Reviews).
 * Loaded by sections/main-product-reviews.html. Keyed by product handle; products without an entry get a deterministic
 * generic set built from their own data (see VolinReviews.for(product)).
 *
 * review: { id, name, location, date (ISO), rating 1–5, title, body, verified, size, usual, height, fit (1 small … 5 large),
 *           quality, comfort, value (1–5), recommend, color, photos[], helpful, unhelpful, reply? { body, date } }
 * stats:  ratings summary across ALL ratings (incl. star-only ratings without text): { count, dist[5★,4★,3★,2★,1★] }
 * question: { id, name, date, body, helpful, answers[{ by, staff, date, body, helpful }] }
 */
(function () {
  const I = (f) => 'assets/images/volin/' + f;

  const HOODIE = {
    stats: { count: 128, dist: [79, 31, 11, 4, 3] },
    highlights: [['Soft fabric', 42, 'soft'], ['True to size', 31, 'true to size'], ['Heavyweight feel', 27, 'heavy'], ['Holds colour', 18, 'colour'], ['Roomy fit', 16, 'roomy'], ['Quality zip', 12, 'zip']],
    reviews: [
      { id: 'czh-01', name: 'Daniel K.', location: 'Brooklyn, NY', date: '2026-10-02', rating: 5, title: 'The hoodie I reach for every morning',
        body: 'I have owned a lot of zip hoodies and this one finally gets the weight right. It is heavy enough to feel substantial but drapes instead of standing off the body. The washed green is even better in person – slightly dusty, not neon at all. After six washes there is no pilling and the zip still runs smooth.',
        verified: true, size: 'M', usual: 'M', height: '175–180 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Green',
        photos: [I('featured.webp'), I('amazing-hoodie.jpg')], helpful: 48, unhelpful: 2,
        reply: { body: 'Thank you Daniel! The green is garment-dyed after sewing, which is why it ages so nicely. Enjoy it.', date: '2026-10-03' } },
      { id: 'czh-02', name: 'Sofia R.', location: 'Austin, TX', date: '2026-09-28', rating: 5, title: 'Soft fabric, beautiful wash',
        body: 'Ordered the black in a small for an oversized look and it is perfect. The brushed inside is really soft and the vintage wash makes it look like a piece I have had for years. Sleeves are a touch long, which I like.',
        verified: true, size: 'S', usual: 'XS', height: '160–165 cm', fit: 4, quality: 5, comfort: 5, value: 4, recommend: true, color: 'Black',
        photos: [I('products/beige-hoodie.jpg')], helpful: 31, unhelpful: 1 },
      { id: 'czh-03', name: 'Marcus T.', location: 'London, UK', date: '2026-09-21', rating: 4, title: 'Great quality, runs a little big',
        body: 'Quality is excellent – thick fleece, sturdy metal zip and the ribbing keeps its shape. It does run roomy though. I am usually a large and the large is quite boxy on me, so size down if you want a cleaner fit. Still keeping it.',
        verified: true, size: 'L', usual: 'L', height: '180–185 cm', fit: 4, quality: 5, comfort: 4, value: 4, recommend: true, color: 'Black',
        photos: [], helpful: 39, unhelpful: 3,
        reply: { body: 'Thanks for the honest note, Marcus. The Core Zip is cut relaxed on purpose – for a closer fit we recommend one size down, as you found.', date: '2026-09-22' } },
      { id: 'czh-04', name: 'Lena W.', location: 'Berlin, DE', date: '2026-09-15', rating: 5, title: 'Heavyweight and still breathable',
        body: 'Wore it on a long train ride and a windy evening walk and it was comfortable for both. It feels heavyweight but I never overheated. The colour has held after washing cold, inside out, as recommended.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Blue',
        photos: [I('cat-hoodie.jpg')], helpful: 22, unhelpful: 0 },
      { id: 'czh-05', name: 'James O.', location: 'Toronto, CA', date: '2026-09-09', rating: 5, title: 'Better than brands twice the price',
        body: 'I bought this on sale and honestly it beats the hoodies I paid three times as much for. The stitching is neat, the zip pull has a nice weight and the hood keeps its shape. Already ordered a second colour.',
        verified: true, size: 'XL', usual: 'XL', height: '185–190 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Green',
        photos: [], helpful: 27, unhelpful: 1 },
      { id: 'czh-06', name: 'Aiko M.', location: 'Seattle, WA', date: '2026-08-30', rating: 4, title: 'Lovely, but the sleeves are long',
        body: 'Fabric and colour are lovely and it is very warm. I am petite so the sleeves come past my hands, but I roll the cuffs and it looks intentional. Would buy again in another colour.',
        verified: true, size: 'XS', usual: 'XS', height: '150–155 cm', fit: 4, quality: 4, comfort: 5, value: 4, recommend: true, color: 'Blue',
        photos: [I('amazing-hoodie-m.jpg')], helpful: 15, unhelpful: 2 },
      { id: 'czh-07', name: 'Oliver P.', location: 'Manchester, UK', date: '2026-08-24', rating: 5, title: 'True to size and very soft',
        body: 'Medium fits exactly like my other mediums – relaxed but not sloppy. The brushed inside is soft without shedding fluff onto my t-shirt, which is a first for me with fleece.',
        verified: true, size: 'M', usual: 'M', height: '175–180 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [], helpful: 19, unhelpful: 0 },
      { id: 'czh-08', name: 'Priya S.', location: 'San Francisco, CA', date: '2026-08-17', rating: 3, title: 'Nice hoodie, colour differs slightly',
        body: 'The quality is good and it is comfortable, but the blue is a bit deeper than in the photos on my screen. Not a deal breaker, just something to know. Fit is true to size.',
        verified: true, size: 'S', usual: 'S', height: '160–165 cm', fit: 3, quality: 4, comfort: 4, value: 3, recommend: true, color: 'Blue',
        photos: [], helpful: 11, unhelpful: 4,
        reply: { body: 'Hi Priya, thank you – every garment-dyed batch varies a little. If the shade is not for you, returns are free within 30 days.', date: '2026-08-18' } },
      { id: 'czh-09', name: 'Noah B.', location: 'Chicago, IL', date: '2026-08-11', rating: 5, title: 'Heavyweight, holds colour, zero shrink',
        body: 'Washed it cold and hung it to dry five times now. No shrinking, colour still deep, and it has softened up nicely. The two-way zip is great when you are sitting down.',
        verified: true, size: 'L', usual: 'L', height: '180–185 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [I('products/beige-hoodie.jpg'), I('cat-hoodie.jpg')], helpful: 24, unhelpful: 1 },
      { id: 'czh-10', name: 'Emma L.', location: 'Paris, FR', date: '2026-08-02', rating: 5, title: 'Roomy fit, exactly what I wanted',
        body: 'I sized up to an M for a roomy, cosy fit and it is perfect over a tee or even a thin knit. The green goes with all my denim. Delivery was fast and the packaging is plastic-free.',
        verified: true, size: 'M', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 4, recommend: true, color: 'Green',
        photos: [I('amazing-hoodie.jpg')], helpful: 17, unhelpful: 0 },
      { id: 'czh-11', name: 'Lucas G.', location: 'Madrid, ES', date: '2026-07-26', rating: 4, title: 'Solid everyday piece',
        body: 'Not flashy, just a really well made hoodie. My only wish is a slightly deeper hood. The quality zip and ribbed cuffs are excellent.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 3, quality: 4, comfort: 4, value: 5, recommend: true, color: 'Black',
        photos: [], helpful: 9, unhelpful: 1 },
      { id: 'czh-12', name: 'Hannah J.', location: 'Denver, CO', date: '2026-07-19', rating: 5, title: 'Gifted one, kept one',
        body: 'Bought one for my partner and ended up ordering one for myself. Soft fabric, beautiful wash and it is unisex enough that we steal each other’s.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Blue',
        photos: [], helpful: 13, unhelpful: 0 },
      { id: 'czh-13', name: 'Ethan C.', location: 'Melbourne, AU', date: '2026-07-10', rating: 2, title: 'Too boxy for me',
        body: 'The fabric is great but the cut is very boxy and the body is short-ish for my height. I am tall and slim, so this might just not be my shape. Exchanged for a size down which helped but did not fix the length.',
        verified: true, size: 'L', usual: 'M', height: '190+ cm', fit: 5, quality: 4, comfort: 3, value: 2, recommend: false, color: 'Black',
        photos: [], helpful: 21, unhelpful: 5,
        reply: { body: 'Sorry the cut was not right for you, Ethan. A Tall fit is on our list for next season – thank you for the feedback that helps make it happen.', date: '2026-07-11' } },
      { id: 'czh-14', name: 'Mia N.', location: 'Amsterdam, NL', date: '2026-07-02', rating: 5, title: 'The perfect washed green',
        body: 'This colour is everything. It looks vintage without being faded, and the fleece is really dense. I am 168 cm and the S hits right at my hip.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Green',
        photos: [I('featured.webp')], helpful: 16, unhelpful: 0 },
      { id: 'czh-15', name: 'Ryan F.', location: 'Dublin, IE', date: '2026-06-24', rating: 4, title: 'Warm and well made',
        body: 'Warm enough to wear as a light jacket in spring. The zip is chunky metal and feels like it will outlast the hoodie. Runs a bit large in the body.',
        verified: false, size: 'XL', usual: 'XL', height: '180–185 cm', fit: 4, quality: 5, comfort: 4, value: 4, recommend: true, color: 'Black',
        photos: [], helpful: 6, unhelpful: 1 },
      { id: 'czh-16', name: 'Chloe D.', location: 'Vancouver, CA', date: '2026-06-15', rating: 5, title: 'So soft after washing',
        body: 'It was already soft when it arrived and it got softer after the first wash. Zero pilling under the arms after two months of almost daily wear.',
        verified: true, size: 'XS', usual: 'XS', height: '155–160 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Blue',
        photos: [], helpful: 12, unhelpful: 0 },
      { id: 'czh-17', name: 'Samuel A.', location: 'Atlanta, GA', date: '2026-06-03', rating: 5, title: 'Instant favourite',
        body: 'Heavyweight feel, clean minimal look and no visible branding – exactly what I was looking for. Pairs perfectly with the utility cargos.',
        verified: true, size: 'L', usual: 'L', height: '175–180 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Green',
        photos: [I('cat-hoodie.jpg')], helpful: 10, unhelpful: 0 },
      { id: 'czh-18', name: 'Grace H.', location: 'Boston, MA', date: '2026-05-22', rating: 4, title: 'Roomy and comfy',
        body: 'Comfortable and roomy, I like it for lounging and travel. Took one star off because the pockets are a bit shallow for my phone.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 4, quality: 4, comfort: 5, value: 4, recommend: true, color: 'Black',
        photos: [], helpful: 8, unhelpful: 2 },
      { id: 'czh-19', name: 'Tomás V.', location: 'Lisbon, PT', date: '2026-05-11', rating: 1, title: 'Zip arrived damaged',
        body: 'The zip pull was bent when it arrived. Customer service sent a replacement within three days, which was great, but the first experience was disappointing.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 3, quality: 2, comfort: 4, value: 3, recommend: false, color: 'Blue',
        photos: [], helpful: 5, unhelpful: 6,
        reply: { body: 'Tomás, we are sorry about the damaged zip and glad the replacement reached you quickly. We have added extra protection to our packaging.', date: '2026-05-12' } },
      { id: 'czh-20', name: 'Isabella F.', location: 'Milan, IT', date: '2026-04-29', rating: 5, title: 'Looks expensive',
        body: 'People keep asking where it is from. The vintage wash and heavy cotton make it look far more expensive than it was. True to size for me.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [I('amazing-hoodie-m.jpg')], helpful: 14, unhelpful: 0 },
      { id: 'czh-21', name: 'Kai L.', location: 'Honolulu, HI', date: '2026-04-14', rating: 4, title: 'Great for cool evenings',
        body: 'Even in a warm climate I wear this most evenings. Thick, but the cotton breathes. Fit is relaxed and true to size.',
        verified: true, size: 'M', usual: 'M', height: '175–180 cm', fit: 3, quality: 4, comfort: 5, value: 4, recommend: true, color: 'Green',
        photos: [], helpful: 4, unhelpful: 0 },
      { id: 'czh-22', name: 'Ava M.', location: 'Stockholm, SE', date: '2026-03-30', rating: 5, title: 'Minimal and well made',
        body: 'No logos, beautiful colour and a quality zip. It sits nicely on the shoulders and the cuffs keep their snap. I will be buying the black next.',
        verified: true, size: 'XS', usual: 'XS', height: '160–165 cm', fit: 2, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Blue',
        photos: [], helpful: 7, unhelpful: 0 },
    ],
    questions: [
      { id: 'czq-1', name: 'Jordan', date: '2026-09-30', body: 'I am between a M and a L and like a relaxed but not baggy fit. Which would you recommend?', helpful: 18,
        answers: [{ by: 'Volin Studio', staff: true, date: '2026-10-01', body: 'The Core Zip is cut relaxed, so we would suggest the M for a relaxed fit and the L only if you want it properly oversized. Chest measurements are in the Size & Fit table.', helpful: 14 }] },
      { id: 'czq-2', name: 'Rachel', date: '2026-09-12', body: 'Does the green shrink or fade after washing?', helpful: 11,
        answers: [{ by: 'Volin Studio', staff: true, date: '2026-09-13', body: 'It is garment-dyed and pre-washed, so shrinkage is minimal (under 2%). Wash cold, inside out, and skip the tumble dryer to keep the colour deep.', helpful: 9 },
                  { by: 'Noah B.', staff: false, date: '2026-09-20', body: 'Five washes in and mine has not shrunk or faded at all.', helpful: 6 }] },
      { id: 'czq-3', name: 'Chris', date: '2026-08-21', body: 'Is the zip metal or plastic? Does it have a two-way slider?', helpful: 7,
        answers: [{ by: 'Volin Studio', staff: true, date: '2026-08-21', body: 'It is a two-way metal zip with a weighted pull – you can open it from the bottom when seated.', helpful: 5 }] },
      { id: 'czq-4', name: 'Maya', date: '2026-07-14', body: 'Is it warm enough to wear without a jacket in autumn?', helpful: 4,
        answers: [{ by: 'Lena W.', staff: false, date: '2026-07-20', body: 'Down to about 12°C I wear it on its own. Below that I add a light jacket over it.', helpful: 3 }] },
      { id: 'czq-5', name: 'Sam', date: '2026-06-02', body: 'Are the pockets deep enough for a phone?', helpful: 3,
        answers: [{ by: 'Volin Studio', staff: true, date: '2026-06-03', body: 'The kangaroo pockets are 17 cm deep, which fits most phones up to 6.7".', helpful: 2 }] },
    ],
  };

  /* ---- generic fallback built from the product itself (deterministic per handle) ---- */
  const NAMES = [['Alex M.', 'Portland, OR'], ['Jamie L.', 'Leeds, UK'], ['Sara K.', 'Oslo, NO'], ['Ben T.', 'Sydney, AU'], ['Nina P.', 'Vienna, AT'],
    ['Leo R.', 'Miami, FL'], ['Zoe C.', 'Glasgow, UK'], ['Max H.', 'Zurich, CH'], ['Ivy W.', 'Phoenix, AZ'], ['Omar F.', 'Toronto, CA']];
  const TEXT = [
    [5, 'Exactly as described', 'The {type} looks exactly like the photos and the quality is excellent. {detail}. I would happily buy it again.'],
    [5, 'Great everyday piece', 'Clean, minimal and very well made. I have worn the {title} at least twice a week since it arrived and it still looks new.'],
    [4, 'Good fit, great material', 'Really like the material – {material}. The fit is true to size for me. Took a star off only because delivery took an extra day.'],
    [5, 'My new favourite', 'Comfortable from the first wear and the colour is beautiful in person. It goes with everything I own.'],
    [4, 'Well made, minimal design', 'You can tell the {type} is built to last. {detail}. Looks great with simple basics.'],
    [3, 'Nice, but check the size guide', 'Quality is good but the fit was different from what I expected – check the size guide before ordering. Exchange was easy.'],
    [5, 'Worth every cent', 'Premium feel at a fair price. The details are thoughtful and it has held up perfectly so far.'],
    [4, 'Solid quality', 'Solid construction and a clean look. I would love more colour options, but otherwise no complaints.'],
  ];
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  function generic(p) {
    const seed = hash(p.handle);
    const sizes = (p.options.find((o) => o.name === 'Size') || { values: ['M'] }).values;
    const colors = (p.options.find((o) => o.name === 'Color') || { values: [''] }).values;
    const imgs = p.images || [];
    const reviews = TEXT.map(([rating, title, body], i) => {
      const n = NAMES[(seed + i) % NAMES.length];
      const size = sizes[(seed + i) % sizes.length];
      const d = new Date(Date.UTC(2026, 9, 6) - (i * 9 + (seed % 5)) * 864e5);
      return {
        id: `${p.handle}-g${i}`, name: n[0], location: n[1], date: d.toISOString().slice(0, 10), rating, title,
        body: body.replace('{type}', (p.type || 'piece').toLowerCase()).replace('{title}', p.title)
          .replace('{detail}', (p.details && p.details[i % p.details.length]) || 'The finish is excellent')
          .replace('{material}', (p.material || 'premium cotton').toLowerCase()),
        verified: i !== 3, size, usual: size, height: ['165–170 cm', '170–175 cm', '175–180 cm', '180–185 cm'][(seed + i) % 4],
        fit: rating === 3 ? 4 : 3, quality: Math.min(5, rating + (i % 2)), comfort: rating, value: Math.max(3, rating - (i % 3 === 0 ? 1 : 0)),
        recommend: rating >= 4, color: colors[(seed + i) % colors.length],
        photos: i === 0 && imgs[1] ? [imgs[1]] : i === 4 && imgs[0] ? [imgs[0]] : [], helpful: 3 + ((seed >> i) % 17), unhelpful: (seed >> (i + 2)) % 3,
        reply: i === 5 ? { body: 'Thank you for the feedback! Our size guide lists exact garment measurements – and exchanges are always free.', date: d.toISOString().slice(0, 10) } : null,
      };
    });
    const count = p.rating_count || 24;
    const five = p.rating >= 5 ? 0.78 : 0.58;
    const dist = [five, 0.88 - five + 0.1, 0.08, 0.025, 0.015].map((x) => Math.round(x * count));
    dist[0] += count - dist.reduce((a, b) => a + b, 0);
    return {
      stats: { count, dist },
      highlights: [['Great quality', Math.round(count * 0.3), 'quality'], ['True to size', Math.round(count * 0.22), 'true to size'], ['Clean design', Math.round(count * 0.15), 'clean'], ['Comfortable', Math.round(count * 0.12), 'comfortable']],
      reviews,
      questions: [
        { id: `${p.handle}-q1`, name: 'Taylor', date: '2026-09-18', body: `How does the ${p.title} fit compared to regular sizing?`, helpful: 6,
          answers: [{ by: 'Volin Studio', staff: true, date: '2026-09-19', body: 'It fits true to size. If you are between sizes, the Size & Fit table lists exact garment measurements – and exchanges are free.', helpful: 4 }] },
        { id: `${p.handle}-q2`, name: 'Morgan', date: '2026-08-07', body: 'How should I care for it?', helpful: 3,
          answers: [{ by: 'Volin Studio', staff: true, date: '2026-08-08', body: p.care || 'Follow the care label: wash cold and dry flat.', helpful: 2 }] },
      ],
    };
  }

  const DATA = { 'core-zip-hoodie': HOODIE };
  window.VolinReviews = { for: (p) => (p && DATA[p.handle]) || generic(p) };
})();
