/*
 * Ween product reviews + Q&A — static stand-in for a reviews app (Judge.me / Okendo / Shopify Product Reviews).
 * Loaded by sections/main-product-reviews.html. Keyed by product handle; products without an entry get a deterministic
 * generic set built from their own options (WeenReviews.for(product)).
 *
 * review:   { id, name, avatar?, location, date (ISO), rating 1–5, title, body, verified, size, usual, height,
 *             fit (1 runs small … 5 runs large), quality, comfort, value (1–5), recommend, color, photos[],
 *             helpful, unhelpful, reply? { body, date } }
 * stats:    summary across ALL ratings (incl. star-only ratings without text): { count, dist: [5★, 4★, 3★, 2★, 1★] }
 * highlights: [label, mentions, keyword]  ("Customers say" chips; keyword filters the list)
 * question: { id, name, date, body, helpful, answers: [{ by, staff, date, body, helpful }] }
 */
(function () {
  const I = (f) => 'assets/images/ween/' + f;
  const AV = { selo: I('products/avatar-selo.jpg'), mara: I('products/avatar-mara.jpg'), ava: I('products/avatar-ava.jpg') };

  const GARTER = {
    stats: { count: 128, dist: [82, 27, 10, 5, 4] },
    highlights: [['Soft lace', 46, 'soft'], ['True to size', 38, 'true to size'], ['Stays in place', 24, 'stay'], ['Gorgeous colour', 21, 'colour'], ['Gift-worthy', 17, 'gift'], ['Delicate straps', 9, 'strap']],
    reviews: [
      { id: 'slg-01', name: 'Selin Z.', avatar: AV.selo, location: 'London, UK', date: '2026-10-09', rating: 5, title: 'Prettier in person than in the photos',
        body: 'The raspberry is a deep, almost jewel-toned red rather than pink, and the lace is genuinely soft — no scratchy edges at all. The belt sits right at my natural waist and the four suspenders stay put through a whole evening without slipping. I wore it under a slip dress for our anniversary dinner and felt incredible. Packaging was beautiful too, tissue and a little card.',
        verified: true, size: 'M', usual: 'M', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Raspberry',
        photos: [I('collage-2.jpg'), I('products/scarlet-lace-set.jpg')], helpful: 64, unhelpful: 2,
        reply: { body: 'Thank you, Selin — happy anniversary! The raspberry is dyed after the lace is finished, which is what gives it that depth. Enjoy every wear.', date: '2026-10-10' } },
      { id: 'slg-02', name: 'Mara L.', avatar: AV.mara, location: 'Austin, TX', date: '2026-10-04', rating: 5, title: 'Finally a garter belt that doesn’t roll',
        body: 'Every garter belt I have owned rolls down at the top edge after an hour. This one has a wider, firmer band with soft elastic on the inside and it simply does not move. The straps are fully adjustable and the clips are metal, not plastic. True to size for me.',
        verified: true, size: 'S', usual: 'S', height: '160–165 cm', fit: 3, quality: 5, comfort: 4, value: 5, recommend: true, color: 'Black',
        photos: [], helpful: 41, unhelpful: 1 },
      { id: 'slg-03', name: 'Ava C.', avatar: AV.ava, location: 'Toronto, CA', date: '2026-09-28', rating: 4, title: 'Beautiful, size up if you are between sizes',
        body: 'Gorgeous lace and the orchid colour is unusual in the best way. I am usually between S and M and went with S — it fits, but the thong is a touch snug at the hips. Next time I would take the M. The belt itself is perfect.',
        verified: true, size: 'S', usual: 'S/M', height: '170–175 cm', fit: 2, quality: 5, comfort: 4, value: 4, recommend: true, color: 'Orchid',
        photos: [I('collage-3.jpg')], helpful: 37, unhelpful: 3,
        reply: { body: 'Thanks Ava! You are right — between sizes we recommend sizing up in the set. Exchanges are free, just reply to your order email.', date: '2026-09-29' } },
      { id: 'slg-04', name: 'Jasmine R.', location: 'Miami, FL', date: '2026-09-21', rating: 5, title: 'Bought it as a gift for myself',
        body: 'Treated myself after a long quarter and zero regrets. Soft lace, scalloped edges that lie flat under a dress, and it arrived in two days in the prettiest box. I already ordered the matching bralette.',
        verified: true, size: 'M', usual: 'M', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 4, recommend: true, color: 'Raspberry',
        photos: [I('collage-5.jpg')], helpful: 28, unhelpful: 0 },
      { id: 'slg-05', name: 'Hannah W.', location: 'Berlin, DE', date: '2026-09-17', rating: 3, title: 'Lovely lace, straps a little short for me',
        body: 'The quality is lovely and the colour is exactly like the photos. I am tall (180 cm) and even with the straps fully extended they were just long enough to reach thigh-high stockings. Would love a long-torso option. Customer service was very kind when I asked.',
        verified: true, size: 'L', usual: 'L', height: '180 cm +', fit: 2, quality: 4, comfort: 3, value: 3, recommend: false, color: 'Black',
        photos: [], helpful: 33, unhelpful: 4,
        reply: { body: 'Hi Hannah, thank you for the honest feedback — a long-torso version is already in sampling and we will email you the moment it launches.', date: '2026-09-18' } },
      { id: 'slg-06', name: 'Leila M.', location: 'Paris, FR', date: '2026-09-12', rating: 5, title: 'Le détail qui change tout',
        body: 'Beautifully finished: every edge is scalloped, the bows are stitched (not glued) and the hardware is nickel-free, which matters for my sensitive skin. Washed it twice by hand and it still looks brand new.',
        verified: true, size: 'S', usual: 'S', height: '160–165 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [I('blog-1.jpg')], helpful: 22, unhelpful: 0 },
      { id: 'slg-07', name: 'Chloe B.', location: 'Sydney, AU', date: '2026-09-05', rating: 4, title: 'Comfortable enough to forget it is on',
        body: 'I expected to take it off after an hour but wore it all night. The lace has a little stretch so nothing digs in. Only reason for four stars: the thong is quite cheeky, which I like, but worth knowing.',
        verified: true, size: 'M', usual: 'M', height: '165–170 cm', fit: 3, quality: 4, comfort: 5, value: 4, recommend: true, color: 'Raspberry',
        photos: [], helpful: 18, unhelpful: 1 },
      { id: 'slg-08', name: 'Priya S.', location: 'Manchester, UK', date: '2026-08-30', rating: 5, title: 'The colour!',
        body: 'Raspberry against darker skin is stunning. The lace pattern is fine and floral, not costume-y at all. Stays in place, true to size, and the clips feel secure. My new favourite set.',
        verified: true, size: 'L', usual: 'L', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Raspberry',
        photos: [I('collage-4.jpg'), I('promo-offer.jpg')], helpful: 26, unhelpful: 0 },
      { id: 'slg-09', name: 'Emma P.', location: 'Dublin, IE', date: '2026-08-22', rating: 5, title: 'Honeymoon approved',
        body: 'Took this on our honeymoon along with the babydoll. Packed flat, no creasing, and it looked perfect straight out of the case. The fit guide was spot on.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 4, value: 5, recommend: true, color: 'Black',
        photos: [], helpful: 15, unhelpful: 0 },
      { id: 'slg-10', name: 'Noor A.', location: 'Dubai, AE', date: '2026-08-14', rating: 4, title: 'Runs a little small in the thong',
        body: 'Belt fits like a dream but the thong is snug — I would size up in the bottom if they sold separately. Lace quality is excellent and it washes well in a mesh bag.',
        verified: true, size: 'M', usual: 'M', height: '160–165 cm', fit: 2, quality: 5, comfort: 3, value: 4, recommend: true, color: 'Orchid',
        photos: [], helpful: 21, unhelpful: 2 },
      { id: 'slg-11', name: 'Sofia G.', location: 'Madrid, ES', date: '2026-08-06', rating: 5, title: 'Feels far more expensive than it is',
        body: 'I have owned designer garter sets at three times the price and this is just as well made. Soft elastic, pretty bows, and the suspenders are long enough for my thigh-highs.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [I('elegance.jpg')], helpful: 19, unhelpful: 1 },
      { id: 'slg-12', name: 'Rachel T.', location: 'Seattle, WA', date: '2026-07-29', rating: 2, title: 'Not for me, but great returns',
        body: 'The lace is pretty but the cut of the belt sat too high on my short torso and the straps pulled. Returned it easily — label in the box, refund in four days. Might try the crimson belt instead.',
        verified: true, size: 'S', usual: 'S', height: '155–160 cm', fit: 4, quality: 4, comfort: 2, value: 3, recommend: false, color: 'Raspberry',
        photos: [], helpful: 24, unhelpful: 6,
        reply: { body: 'Sorry it was not the one, Rachel. Our Crimson Lace Garter Belt sits lower on the waist and has shorter straps — a great match for a petite torso.', date: '2026-07-30' } },
      { id: 'slg-13', name: 'Olivia K.', location: 'New York, NY', date: '2026-07-21', rating: 5, title: 'Third one I have bought',
        body: 'Black, then raspberry, now orchid. Consistent quality every time, which is rare. The fit hasn’t changed after a year of hand washing.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Orchid',
        photos: [], helpful: 30, unhelpful: 0 },
      { id: 'slg-14', name: 'Bianca F.', location: 'Milan, IT', date: '2026-07-12', rating: 4, title: 'Elegant, not costume',
        body: 'I was worried it would look cheap or theatrical but it is genuinely elegant. The thong could be a bit wider at the back for comfort, otherwise lovely.',
        verified: false, size: 'S', usual: 'XS/S', height: '160–165 cm', fit: 3, quality: 4, comfort: 4, value: 4, recommend: true, color: 'Black',
        photos: [], helpful: 9, unhelpful: 1 },
      { id: 'slg-15', name: 'Tara N.', location: 'Auckland, NZ', date: '2026-07-03', rating: 5, title: 'Soft lace, zero itch',
        body: 'My skin reacts to most lace and this was completely fine — soft on the inside, nothing scratchy at the seams. Stays in place when I sit and stand.',
        verified: true, size: 'L', usual: 'L', height: '170–175 cm', fit: 3, quality: 5, comfort: 5, value: 4, recommend: true, color: 'Raspberry',
        photos: [I('blog-3.jpg')], helpful: 14, unhelpful: 0 },
      { id: 'slg-16', name: 'Grace H.', location: 'Edinburgh, UK', date: '2026-06-24', rating: 5, title: 'Perfect bridal shower gift',
        body: 'Bought it for my best friend’s bridal shower and she cried (happy tears). The box and tissue made it feel so special. I checked the size chart with her measurements and it was exact.',
        verified: true, size: 'M', usual: 'M', height: '165–170 cm', fit: 3, quality: 5, comfort: 4, value: 5, recommend: true, color: 'Orchid',
        photos: [], helpful: 11, unhelpful: 0 },
      { id: 'slg-17', name: 'Ines V.', location: 'Lisbon, PT', date: '2026-06-15', rating: 3, title: 'Pretty but runs large in the belt',
        body: 'The belt was loose on the tightest hook for me, so I exchanged for a size down which fits well. Lace is lovely and the colour is rich. Three stars for the extra step.',
        verified: true, size: 'M', usual: 'S', height: '160–165 cm', fit: 4, quality: 4, comfort: 3, value: 3, recommend: true, color: 'Black',
        photos: [], helpful: 12, unhelpful: 2 },
      { id: 'slg-18', name: 'Maya J.', location: 'Chicago, IL', date: '2026-06-02', rating: 5, title: 'Confidence in a box',
        body: 'There is something about well-made lingerie that changes how you carry yourself. This set does that. Wore it under jeans and a blazer to a big presentation — nobody knew, but I did.',
        verified: true, size: 'S', usual: 'S', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Raspberry',
        photos: [I('collage-1.jpg')], helpful: 27, unhelpful: 1 },
      { id: 'slg-19', name: 'Zoe L.', location: 'Vancouver, CA', date: '2026-05-20', rating: 1, title: 'One clip came off',
        body: 'Loved how it looked but one of the suspender clips came loose on the second wear. Customer care sent a replacement the same week, so the service is great — just a shame about the first one.',
        verified: true, size: 'M', usual: 'M', height: '170–175 cm', fit: 3, quality: 2, comfort: 3, value: 2, recommend: false, color: 'Black',
        photos: [], helpful: 16, unhelpful: 5,
        reply: { body: 'Zoe, we are so sorry. That batch of clips has since been replaced with a stronger stitched-in hook, and your replacement has the new version. Thank you for flagging it.', date: '2026-05-21' } },
      { id: 'slg-20', name: 'Camille D.', location: 'Brussels, BE', date: '2026-05-08', rating: 5, title: 'Everything I hoped for',
        body: 'Soft, delicate and well made. True to size with my usual M. The raspberry is a showstopper and the lace still looks new after a dozen washes.',
        verified: true, size: 'M', usual: 'M', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Raspberry',
        photos: [], helpful: 8, unhelpful: 0 },
    ],
    questions: [
      { id: 'q-slg-1', name: 'Anna', date: '2026-10-01', body: 'Are the suspender straps long enough for thigh-high stockings if I am 175 cm?', helpful: 14,
        answers: [{ by: 'Ween Studio', staff: true, date: '2026-10-01', body: 'Yes — the straps adjust from 18 to 27 cm, which suits most heights up to around 178 cm. If you are taller, size up in the belt for a little extra length.', helpful: 11 }] },
      { id: 'q-slg-2', name: 'Lena', date: '2026-09-19', body: 'Can I wear the garter belt without stockings, just as a look?', helpful: 9,
        answers: [{ by: 'Ween Studio', staff: true, date: '2026-09-19', body: 'Absolutely. The suspenders are fully detachable, so you can wear the belt on its own as a lace waist piece.', helpful: 7 },
                  { by: 'Mara L.', staff: false, date: '2026-09-22', body: 'I do this all the time under sheer skirts — looks lovely.', helpful: 4 }] },
      { id: 'q-slg-3', name: 'Joy', date: '2026-09-02', body: 'Is the thong lined?', helpful: 6,
        answers: [{ by: 'Ween Studio', staff: true, date: '2026-09-03', body: 'The thong has a soft cotton gusset; the rest is unlined stretch lace.', helpful: 5 }] },
      { id: 'q-slg-4', name: 'Kim', date: '2026-08-11', body: 'Does the raspberry colour bleed in the wash?', helpful: 4,
        answers: [{ by: 'Ween Studio', staff: true, date: '2026-08-12', body: 'It is colour-fast, but for the first wash we recommend washing it separately in cold water — then with similar colours after that.', helpful: 3 }] },
    ],
  };

  const BRA = {
    stats: { count: 172, dist: [138, 24, 6, 2, 2] },
    highlights: [['Supportive', 52, 'support'], ['True to size', 41, 'true to size'], ['No digging wire', 23, 'wire'], ['Soft lace', 22, 'soft'], ['Pretty bow', 11, 'bow']],
    reviews: [
      { id: 'clb-01', name: 'Mara L.', avatar: AV.mara, location: 'Austin, TX', date: '2026-10-06', rating: 5, title: 'Support without the stiffness',
        body: 'I am a 34C and usually find plunge bras either flimsy or armoured. This is the middle ground — light lining, wire that sits flat against my ribs and lace that is soft enough to wear all day. True to size.',
        verified: true, size: '34C', usual: '34C', height: '165–170 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Crimson',
        photos: [I('products/crimson-lace-bra.jpg')], helpful: 38, unhelpful: 1 },
      { id: 'clb-02', name: 'Ava C.', avatar: AV.ava, location: 'Toronto, CA', date: '2026-09-25', rating: 4, title: 'Band runs slightly tight',
        body: 'The band is snug on the loosest hook for my usual 36B; it will relax, but if you like a looser band try the sister size 38A. The colour is a rich, deep crimson.',
        verified: true, size: '36B', usual: '36B', height: '170–175 cm', fit: 2, quality: 5, comfort: 4, value: 4, recommend: true, color: 'Crimson',
        photos: [], helpful: 21, unhelpful: 2,
        reply: { body: 'Great sizing tip, Ava — the band relaxes by about 2 cm after a few wears. Thank you!', date: '2026-09-26' } },
      { id: 'clb-03', name: 'Selin Z.', avatar: AV.selo, location: 'London, UK', date: '2026-09-14', rating: 5, title: 'The bow is the cutest detail',
        body: 'Beautiful under a sheer blouse, and the cups don’t gape when I lean forward. The black is just as lovely as the crimson.',
        verified: true, size: '34B', usual: '34B', height: '160–165 cm', fit: 3, quality: 5, comfort: 5, value: 5, recommend: true, color: 'Black',
        photos: [], helpful: 17, unhelpful: 0 },
    ],
    questions: [
      { id: 'q-clb-1', name: 'Rita', date: '2026-09-30', body: 'Are the straps convertible to halterneck?', helpful: 5,
        answers: [{ by: 'Ween Studio', staff: true, date: '2026-09-30', body: 'They are adjustable but not convertible on this style. Our Noir Balconette has convertible straps.', helpful: 4 }] },
    ],
  };

  const DATA = { 'scarlet-lace-garter-set': GARTER, 'crimson-lace-bra': BRA };

  /* ---------- generic fallback, deterministic per product ---------- */
  const NAMES = [['Lina R.', 'Lyon, FR'], ['Sara K.', 'Oslo, NO'], ['Mia T.', 'Denver, CO'], ['Emily S.', 'Bristol, UK'], ['Nadia F.', 'Cairo, EG'],
    ['Julia W.', 'Vienna, AT'], ['Hana Y.', 'Osaka, JP'], ['Isla M.', 'Glasgow, UK'], ['Carmen L.', 'Seville, ES'], ['Ruby P.', 'Melbourne, AU'], ['Elif D.', 'Istanbul, TR'], ['Nora B.', 'Boston, MA']];
  const TEXTS = [
    [5, 'Soft, delicate and beautifully made', 'The fabric is so soft I forget I am wearing it. True to size, beautifully packed and it arrived in two days — I have already ordered a second colour.', 3],
    [5, 'My new favourite', 'Comfortable from morning to night, no digging, no itching. It looks delicate but has held up perfectly after many washes in a mesh bag.', 3],
    [4, 'Lovely, runs a touch small', 'Gorgeous finish and the colour is exactly like the photos. It runs slightly small for me — if you are between sizes, size up.', 2],
    [5, 'Feels luxurious', 'Every edge is finished and the details are stitched, not glued. Feels far more expensive than it is. Highly recommend.', 3],
    [4, 'Great everyday piece', 'Not the most dramatic piece I own, but the one I reach for most. Breathable and smooth under clothes.', 3],
    [5, 'Confidence boost', 'I feel incredible in it. The fit guide was spot on and the exchange for a different colour was effortless.', 3],
    [3, 'Pretty but a little roomy', 'Quality is lovely, but it came up a bit large on me. Exchanged for a size down without any fuss.', 4],
    [5, 'Perfect gift', 'Bought as a gift and it was a huge hit — the box, the tissue, the little card. True to size.', 3],
  ];
  const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

  function generic(p) {
    const h = hash(p.handle);
    const sizes = (p.options.find((o) => o.name === 'Size') || { values: ['M'] }).values;
    const colors = (p.options.find((o) => o.name === 'Color') || { values: [''] }).values;
    const photos = p.images.filter((x) => !x.endsWith('.webp'));
    const n = 8;
    const reviews = Array.from({ length: n }, (_, i) => {
      const [rating, title, body, fit] = TEXTS[(h + i) % TEXTS.length];
      const [name, location] = NAMES[(h + i * 5) % NAMES.length];
      const size = sizes[(h + i) % sizes.length];
      const d = new Date(Date.UTC(2026, 9, 8) - (i * 9 + (h % 5)) * 864e5).toISOString().slice(0, 10);
      return { id: `${p.handle}-g${i}`, name, location, date: d, rating, title, body, verified: i % 4 !== 3, size, usual: fit === 2 ? sizes[Math.min(sizes.length - 1, sizes.indexOf(size) + 1)] : size,
        height: ['155–160 cm', '160–165 cm', '165–170 cm', '170–175 cm'][(h + i) % 4], fit, quality: Math.min(5, rating + (i % 2)), comfort: rating, value: Math.max(3, rating - (i % 2)),
        recommend: rating >= 4, color: colors[(h + i) % colors.length], photos: i === 0 && photos[0] ? [photos[0]] : i === 3 && photos[1] ? [photos[1]] : [],
        helpful: 30 - i * 3 + (h % 4), unhelpful: i % 3,
        reply: i === 2 ? { body: 'Thank you for the sizing note! Between sizes we recommend sizing up — and exchanges are always free.', date: d } : undefined };
    });
    // distribution that matches the catalog rating
    const count = p.rating_count || 40;
    const r = p.rating || 4.5;
    const five = Math.round(count * Math.min(0.92, Math.max(0.4, (r - 3.6) / 1.4)));
    const rest = count - five;
    const dist = [five, Math.round(rest * 0.6), Math.round(rest * 0.22), Math.round(rest * 0.1)];
    dist.push(Math.max(0, count - dist.reduce((a, b) => a + b, 0)));
    return {
      stats: { count, dist },
      highlights: [['Soft fabric', Math.round(count * 0.3), 'soft'], ['True to size', Math.round(count * 0.22), 'true to size'], ['Comfortable', Math.round(count * 0.18), 'comfortable'], ['Well made', Math.round(count * 0.12), 'made'], ['Gift-worthy', Math.round(count * 0.06), 'gift']],
      reviews,
      questions: [
        { id: `${p.handle}-q1`, name: 'Alex', date: '2026-09-20', body: `How does the ${p.title} fit — true to size?`, helpful: 6,
          answers: [{ by: 'Ween Studio', staff: true, date: '2026-09-20', body: 'It fits true to size. If you are between sizes, we recommend sizing up for comfort. Our size guide has exact measurements.', helpful: 5 }] },
        { id: `${p.handle}-q2`, name: 'Sam', date: '2026-08-30', body: 'How should I wash it?', helpful: 3,
          answers: [{ by: 'Ween Studio', staff: true, date: '2026-08-31', body: 'Hand wash cold with a mild detergent, or use a mesh bag on a delicate cycle. Lay flat to dry, away from direct heat.', helpful: 2 }] },
      ],
    };
  }

  window.WeenReviews = {
    for(p) { return p ? DATA[p.handle] || generic(p) : { stats: { count: 0, dist: [0, 0, 0, 0, 0] }, highlights: [], reviews: [], questions: [] }; },
  };
})();
