/*
 * Ween journal extras (-> Shopify: blog + article metafields). Loaded by sections main-blog / main-article
 * as a plain <script> before Alpine starts. Base article data (title, cover, author, date, views…) stays in
 * THEME.articles (assets/ween/catalog.js); this file only adds what the blog/article templates need on top:
 *
 *   WeenJournal.categories          [{ handle, title, description }]     -> blog tags used as categories
 *   WeenJournal.authors[name]       { name, role, bio, avatar? }        -> article.author + metafield bio
 *   WeenJournal.posts[handle]       { category, sections[], comments[] } -> article.content (rich body)
 *     section = { id, title, blocks: [ {type:'p',text} | {type:'quote',text,cite} | {type:'list',items,ordered?}
 *                 | {type:'image',src,alt,caption} | {type:'products',title,handles[]} | {type:'tip',title,text} ] }
 *   WeenJournal.post(handle)        merged article (catalog article + extras) or null
 */
(function () {
  const IMG = 'assets/images/ween/';

  const categories = [
    { handle: 'style', title: 'Style', description: 'Edits, colour stories and how to wear them.' },
    { handle: 'fit', title: 'Fit & sizing', description: 'Measure, adjust and find the one that feels right.' },
    { handle: 'care', title: 'Care', description: 'Keep lace, mesh and cotton looking new for longer.' },
    { handle: 'wellbeing', title: 'Wellbeing', description: 'Rituals for slower evenings and better sleep.' },
    { handle: 'studio', title: 'Inside Ween', description: 'Our studio, our mills and the people behind them.' },
  ];

  const authors = {
    'Selo Z.': { name: 'Selo Zandi', role: 'Creative director', bio: 'Selo leads design at Ween. She sketches every collection by hand and has spent twelve years working with lace mills in Calais and Como.' },
    'Mara L.': { name: 'Mara Lindqvist', role: 'Head of fit', bio: 'Mara is a certified bra fitter who has measured more than 4,000 customers. She runs our fit sessions and writes the Ween size guide.' },
    'Ava C.': { name: 'Ava Castell', role: 'Studio & materials', bio: 'Ava looks after fabrics, care testing and our supply chain. If a piece survives 50 washes in our studio, it is ready for you.' },
  };

  const posts = {
    'elegance-in-every-detail': {
      category: 'style',
      sections: [
        { id: 'details-up-close', title: 'The details you notice up close', blocks: [
          { type: 'p', text: 'Great lingerie starts with the details you only notice up close: a scalloped edge that lies flat, a seam placed exactly where it flatters, a strap that stays put. None of them shout, but together they decide whether a piece feels special or simply ordinary.' },
          { type: 'p', text: 'This season we went back to French-style floral lace and paired it with modern stretch mesh. The result is lighter, softer and more breathable — and it still looks unmistakably Ween.' },
          { type: 'quote', text: 'Luxury is not how a piece looks on the hanger. It is how it feels at eleven at night, after a long day.', cite: 'Selo Zandi, creative director' },
        ] },
        { id: 'what-to-look-for', title: 'What to look for when you shop lace', blocks: [
          { type: 'p', text: 'When you shop lace, three things matter more than the pattern itself. Check them in store, or read the product details before you order:' },
          { type: 'list', items: ['A soft hand-feel — good lace drapes and never scratches against skin.', 'Finished edges — scallops should be cut along the motif, not hemmed over it.', 'Stretch that recovers — pull gently and let go; it should spring straight back.'] },
          { type: 'image', src: IMG + 'collage-1.jpg', alt: 'Model in a black lace set reclining on a pale sofa', caption: 'Scalloped Chantilly-style lace, cut along the motif so the edge lies flat.' },
        ] },
        { id: 'build-your-edit', title: 'Build your edit around one hero piece', blocks: [
          { type: 'p', text: 'Start with one hero piece — a bralette or a garter set — and build around it with basics in black and crimson. Two or three pieces that mix freely will give you more outfits than a drawer of one-offs.' },
          { type: 'products', title: 'Shop the look', handles: ['elegant-lace-bralette', 'scarlet-lace-garter-set', 'noir-strappy-lace-panty'] },
          { type: 'tip', title: 'Stylist’s note', text: 'Match the lace, not the colour. A black bralette and a crimson brief in the same floral lace look intentional; two different laces in the same colour rarely do.' },
        ] },
      ],
      comments: [
        { name: 'Hannah W.', date: '2026-10-08', text: 'The tip about matching the lace instead of the colour completely changed how I shop. Thank you!' },
        { name: 'Julia M.', date: '2026-10-07', text: 'I own the Elegant Lace Bralette in black and it really is as soft as described. Ordering the crimson next.' },
      ],
    },
    'finding-your-perfect-fit': {
      category: 'fit',
      sections: [
        { id: 'band-first', title: 'Band first, cups second', blocks: [
          { type: 'p', text: 'Around 80% of people wear the wrong bra size, and the band is almost always the culprit. The band carries most of the support, so it should sit level and snug on the loosest hook — that way you can tighten it as the elastic relaxes over time.' },
          { type: 'tip', title: 'Quick check', text: 'You should be able to slide two fingers under the band at the back, but not much more. If it rides up, go down a band size.' },
        ] },
        { id: 'measure-at-home', title: 'Measure yourself at home', blocks: [
          { type: 'p', text: 'All you need is a soft tape measure, a mirror and five minutes. Wear a non-padded bra or nothing at all.' },
          { type: 'list', ordered: true, items: ['Measure snugly under your bust, keep the tape level and exhale. Round to the nearest inch — that is your band.', 'Measure loosely around the fullest part of your bust, again keeping the tape level.', 'Subtract the band from the bust measurement. Every inch of difference is roughly one cup size: 1" = A, 2" = B, 3" = C, 4" = D.'] },
          { type: 'image', src: IMG + 'collage-4.jpg', alt: 'Model in a black plunge bra photographed against a soft grey wall', caption: 'A well-fitted band sits level all the way around — no arching at the back.' },
        ] },
        { id: 'sister-sizes', title: 'Troubleshooting and sister sizes', blocks: [
          { type: 'p', text: 'If the cups wrinkle, go down a cup; if the wire sits on breast tissue, go up. Sister sizes share the same cup volume on a different band, which is useful when a style runs small or large.' },
          { type: 'quote', text: 'A bra that fits is the most comfortable thing you will wear all day. If it hurts, it is the size — not you.', cite: 'Mara Lindqvist, head of fit' },
          { type: 'list', items: ['34B ↔ 32C ↔ 36A share the same cup volume.', 'Straps digging in? The band is usually too loose and the straps are doing its job.', 'Gaping at the top of the cup often means a different shape, not a smaller size — try a balconette.'] },
          { type: 'products', title: 'Easy-fit favourites', handles: ['soft-triangle-bra', 'noir-balconette-set', 'everyday-cotton-bralette'] },
        ] },
      ],
      comments: [
        { name: 'Priya S.', date: '2026-09-29', text: 'Went from a 36B to a 34C after reading this. I had no idea the band mattered so much — so much more comfortable now.' },
        { name: 'Elena R.', date: '2026-09-26', text: 'The sister size table is so useful. Could you write one about strapless fits next?' },
        { name: 'Chloe D.', date: '2026-09-25', text: 'Booked a fit session after this and Mara was lovely. Highly recommend.' },
      ],
    },
    'caring-for-lace': {
      category: 'care',
      sections: [
        { id: 'wash-gently', title: 'Wash gently, in cold water', blocks: [
          { type: 'p', text: 'Lace is resilient when you treat it gently. Hand wash in cold water with a mild, enzyme-free detergent and press — never wring — the water out. Warm water relaxes elastane and dulls deep colours like crimson.' },
          { type: 'list', items: ['Fasten every hook before washing so it cannot snag.', 'Use a mesh bag if you must use the machine, on a delicate 30° cycle.', 'Skip fabric softener — it coats the fibres and makes lace lose its spring.'] },
        ] },
        { id: 'dry-and-store', title: 'Dry flat, store with care', blocks: [
          { type: 'p', text: 'Dry flat in the shade. Heat breaks down elastane, which is what keeps your favourite pieces fitting the way they did on day one. Never put lace in the dryer or on a radiator.' },
          { type: 'image', src: IMG + 'promo-comfort.jpg', alt: 'Crimson lace lingerie laid flat on white linen', caption: 'Lay pieces flat on a towel and reshape cups while they are still damp.' },
          { type: 'tip', title: 'Storage tip', text: 'Keep moulded cups nested, not folded in half, and give garter belts their own pouch so the clips do not catch on lace.' },
        ] },
        { id: 'rotate', title: 'Rotate your favourites', blocks: [
          { type: 'p', text: 'Elastic needs a day to recover after wear. Rotating between three bras makes each one last noticeably longer — and gives you a reason to try a new colour.' },
          { type: 'quote', text: 'Every Ween piece goes through fifty washes in our studio before it reaches you. Follow the label and it will easily do the same for you.', cite: 'Ava Castell, studio & materials' },
          { type: 'products', title: 'Pieces that love a gentle wash', handles: ['crimson-lace-bra', 'rouge-lace-thong', 'sheer-mesh-bralette'] },
        ] },
      ],
      comments: [
        { name: 'Nora B.', date: '2026-09-14', text: 'I had been using fabric softener for years… no wonder my lace felt stiff. Great article!' },
      ],
    },
    'the-crimson-edit': {
      category: 'style',
      sections: [
        { id: 'quieter-red', title: 'A quieter kind of red', blocks: [
          { type: 'p', text: 'Red lingerie has always been a statement. This year it is quieter — deeper crimson, softer lace, and pieces you actually reach for on a Tuesday, not only on a special occasion.' },
          { type: 'image', src: IMG + 'collage-3.jpg', alt: 'Model in crimson lace lingerie against a red backdrop', caption: 'Our crimson is dyed to sit between scarlet and wine, so it flatters every skin tone.' },
        ] },
        { id: 'how-to-wear', title: 'Three ways to wear crimson', blocks: [
          { type: 'list', ordered: true, items: ['Contrast: a crimson bralette with black briefs and a sheer black shirt.', 'Tonal: head-to-toe red with a garter set for an evening that feels like an occasion.', 'Hidden: a crimson set under a camel knit — nobody needs to know but you.'] },
          { type: 'products', title: 'Shop the crimson edit', handles: ['crimson-lace-bra', 'crimson-garter-belt', 'scarlet-lace-lingerie-set'] },
        ] },
        { id: 'under-white', title: 'Under a white shirt?', blocks: [
          { type: 'p', text: 'Choose a shade close to your skin tone instead — even white shows through white. Save the crimson for when you want it seen.' },
          { type: 'quote', text: 'Crimson is the most confident colour we make. It is not about being looked at; it is about how you carry yourself.', cite: 'Selo Zandi, creative director' },
        ] },
      ],
      comments: [
        { name: 'Amelia K.', date: '2026-09-02', text: 'The crimson garter belt is stunning in person. The colour really is deeper than the photos.' },
        { name: 'Sofia T.', date: '2026-08-31', text: 'Love the “hidden” idea. Wearing my crimson set under a grey sweater right now.' },
      ],
    },
    'comfort-first-sleepwear': {
      category: 'wellbeing',
      sections: [
        { id: 'what-you-sleep-in', title: 'What you sleep in matters', blocks: [
          { type: 'p', text: 'Breathable cotton and loose cuts help your body regulate temperature through the night, so you fall asleep faster and wake up less. Synthetic satin looks beautiful but traps heat.' },
          { type: 'list', items: ['Choose natural fibres: cotton, modal or silk.', 'Look for flat seams and covered elastic at the waist.', 'Size up if you are between sizes — sleepwear should never pinch.'] },
        ] },
        { id: 'evening-ritual', title: 'A small evening ritual', blocks: [
          { type: 'p', text: 'Build a small evening ritual: dim lights an hour before bed, a warm shower, then change into something that feels like a deep breath. The change of clothes is a signal to your body that the day is done.' },
          { type: 'image', src: IMG + 'elegance.jpg', alt: 'Model in soft black lingerie sitting in warm evening light', caption: 'Soft light and soft fabrics: the simplest way to switch off.' },
          { type: 'tip', title: 'Try this tonight', text: 'Put your phone on the other side of the room and read ten pages of a paper book. Most people are asleep before page eight.' },
        ] },
        { id: 'lazy-sunday', title: 'And for the lazy Sunday that follows', blocks: [
          { type: 'p', text: 'Our Cloud Cotton Lounge Set was designed for exactly that — and for the slow morning after. Pair it with the cotton brief for a set you will not want to take off.' },
          { type: 'products', title: 'Sleep & lounge', handles: ['cloud-lounge-set', 'cherry-cotton-brief', 'everyday-cotton-bralette'] },
        ] },
      ],
      comments: [
        { name: 'Lea F.', date: '2026-08-20', text: 'The lounge set is the softest thing I own. Sleeping so much better since I swapped my satin pyjamas.' },
      ],
    },
    'behind-the-seams': {
      category: 'studio',
      sections: [
        { id: 'from-sketch', title: 'From the first sketch', blocks: [
          { type: 'p', text: 'Every Ween piece starts as a hand sketch in our studio, then goes through at least three fittings on real bodies of different sizes. We adjust strap angles by millimetres and redraw cups until they work from a 30A to a 38F.' },
          { type: 'quote', text: 'If it only looks good on one body, it is not finished yet.', cite: 'Selo Zandi, creative director' },
        ] },
        { id: 'our-mills', title: 'Two family-run lace mills', blocks: [
          { type: 'p', text: 'We work with two family-run lace mills — one in northern France, one near Lake Como — that have woven lace for four generations. Ordering smaller runs costs us more, but it means less waste and lace that is truly exceptional.' },
          { type: 'image', src: IMG + 'collage-1.jpg', alt: 'Detail of black floral lace on a model', caption: 'Leavers lace is woven on machines that are over a hundred years old.' },
          { type: 'list', items: ['Recycled and recyclable packaging for every order.', 'Offcuts become scrunchies and lingerie bags.', 'Fair-wage partner workshops, audited every year.'] },
        ] },
        { id: 'final-stitch', title: 'To the final stitch', blocks: [
          { type: 'p', text: 'It takes longer, and we think it shows — in the fit, in the finish and in how long your lingerie lasts. These are the pieces our studio team reaches for most.' },
          { type: 'products', title: 'Studio favourites', handles: ['strappy-lace-set', 'rose-bustier-set', 'midnight-lace-babydoll'] },
        ] },
      ],
      comments: [
        { name: 'Isabel G.', date: '2026-08-04', text: 'Love knowing where my lingerie comes from. The packaging is beautiful too.' },
        { name: 'Marta P.', date: '2026-08-01', text: 'Would love a video tour of the lace mill!' },
      ],
    },
  };

  const post = (handle) => {
    const a = (window.THEME.articles || []).find((x) => x.handle === handle);
    if (!a) return null;
    const extra = posts[handle] || {};
    const sections = extra.sections || [{ id: 'story', title: 'The story', blocks: (a.body || []).map((t) => ({ type: 'p', text: t })) }];
    return { ...a, category: extra.category || 'style', sections, comments: extra.comments || [] };
  };

  window.WeenJournal = { categories, authors, posts, post,
    categoryOf: (handle) => categories.find((c) => c.handle === ((posts[handle] || {}).category || 'style')) || categories[0] };
})();
