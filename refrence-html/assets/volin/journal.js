/*
 * Volin journal (blog) extras — long-form article bodies, authors, topics and seed comments.
 * In Shopify: article.content (rich text), article.author, blog.all_tags, article.comments.
 * Load after assets/volin/catalog.js. Exposes window.VOLIN_JOURNAL.
 *
 * Body blocks:  ['lead', text] ['p', text] ['h2', text] ['quote', text, cite] ['ul', [items]] ['ol', [items]]
 *               ['img', src, caption] ['shop', [handles], heading] ['tip', title, text]
 */
(function () {
  const I = (f) => 'assets/images/volin/' + f;
  const P = (f) => I('products/' + f);

  const topics = [
    { handle: 'styling', title: 'Styling', description: 'Outfit formulas and proportion rules.' },
    { handle: 'guides', title: 'Guides', description: 'Fit, fabric and construction, explained.' },
    { handle: 'care', title: 'Care', description: 'Keep your essentials looking new for years.' },
    { handle: 'essentials', title: 'Essentials', description: 'Building a wardrobe that works together.' },
  ];

  const authors = {
    'Ethan Carter': { name: 'Ethan Carter', role: 'Head of Design', avatar: I('blog-avatar.jpg'),
      bio: 'Ethan leads the Volin design studio. Fifteen years of pattern cutting taught him that the best garments disappear into your day – he writes about fit, proportion and the quiet details that make essentials last.' },
    'Mia Novak': { name: 'Mia Novak', role: 'Fabric & Care Editor', avatar: I('review-avatar.jpg'),
      bio: 'Mia sources every fabric we use and tests it to destruction first. She writes the care guides, the fabric deep-dives and, occasionally, a strongly worded note about tumble dryers.' },
  };

  const content = {
    1: [
      ['lead', 'A great t-shirt is the most honest piece in your wardrobe. It shows fit, fabric and proportion with nothing to hide behind – which is exactly why getting it right changes everything else you wear.'],
      ['h2', 'Start with the weight'],
      ['p', 'Weight is the single biggest difference between a tee that looks intentional and one that looks like underwear. A 220–260 gsm cotton jersey drapes cleanly, keeps its shape after washing and does not cling. Anything under 160 gsm turns translucent in daylight and twists at the side seams after a few washes.'],
      ['p', 'Hold the fabric up to a window: if you can see your hand clearly, it will not hold a silhouette. Our Heavyweight Boxy Tee is cut from a 240 gsm combed cotton for exactly that reason.'],
      ['img', I('blog.jpg'), 'A boxy heavyweight tee, straight denim and a clean court sneaker – the simplest smart-casual uniform there is.'],
      ['h2', 'Get the proportions right'],
      ['p', 'Boxy tees want a straight or relaxed leg underneath. Slim tees want a slimmer trouser. Mixing a cropped boxy fit with a skinny jean reads unbalanced; mixing it with a wide cargo reads deliberate.'],
      ['ul', [
        'The shoulder seam should sit on, or just past, your shoulder bone.',
        'The hem should land around the middle of your fly when untucked.',
        'Sleeves should end mid-bicep – long enough to cover, short enough to frame the arm.',
      ]],
      ['quote', 'Wear the tee, don’t let it wear you. If you notice the shirt before you notice the person, the fit is wrong.', 'Ethan Carter, Head of Design'],
      ['h2', 'Think in layers'],
      ['p', 'An open overshirt or a light bomber turns the same tee into an evening look. A tucked tee with pleated trousers and a slim belt works for the office. The rule is simple: the tee stays clean and plain, the layer on top brings the texture.'],
      ['shop', ['heavyweight-boxy-tee', 'twill-over-jacket'], 'Shop the look'],
      ['h2', 'Keep the palette tight'],
      ['p', 'Black, off-white, stone and olive all speak to each other. Build around them and every new piece multiplies the outfits you already own instead of starting a new conversation.'],
      ['tip', 'Studio tip', 'Buy your most-worn colour twice. Rotate them and both will age at the same pace – so you always have a crisp one ready.'],
    ],
    2: [
      ['lead', 'A capsule wardrobe is not about owning less for the sake of it. It is about owning pieces that all work together – so getting dressed takes thirty seconds and every outfit looks considered.'],
      ['h2', 'The twelve foundations'],
      ['p', 'Start with the pieces you reach for every week. Everything else is decoration. Our studio capsule looks like this:'],
      ['ol', [
        'Two heavyweight tees – one black, one off-white.',
        'One brushed-back hoodie and one crewneck knit.',
        'Straight-leg denim and a relaxed cargo trouser.',
        'One overshirt and one light bomber.',
        'A pair of clean leather sneakers and a slim card wallet.',
      ]],
      ['img', I('hero.jpg'), 'Twelve pieces on one rail. If it does not fit here, it does not make the cut.'],
      ['h2', 'One base, one accent'],
      ['p', 'Choose a neutral base – black and stone, or navy and cream – and add a single accent colour. Every new piece should pair with at least three things you already own. If it does not, it is an outfit, not a wardrobe piece.'],
      ['quote', 'The best capsule is the one you stop thinking about. It just works, every morning.', 'Ethan Carter'],
      ['shop', ['core-zip-hoodie', 'utility-cargo-pants'], 'Capsule essentials'],
      ['h2', 'Buy slower, buy better'],
      ['p', 'Replace pieces when they wear out, not when trends move. Spend more on what touches your body every day – tees, hoodies, sneakers – and less on what you wear twice a season.'],
      ['tip', 'Rule of thirty', 'Before you buy, ask whether you will wear it thirty times. If the honest answer is no, leave it on the rail.'],
    ],
    3: [
      ['lead', 'Heavyweight cotton is built to last, but heat is its enemy. Wash cold, dry flat and your favourite hoodie will look better in year three than on day one.'],
      ['h2', 'Wash cold, inside out'],
      ['p', 'Turn garments inside out to protect the face of the fabric and any garment-dyed colour. Thirty degrees is plenty for everyday wear – modern detergents are designed for it, and your fleece stays plush instead of matting.'],
      ['ul', [
        'Close zips and empty pockets before washing.',
        'Wash darks with darks – vintage-washed pieces can still release dye in the first few washes.',
        'Use half the detergent you think you need. Residue makes cotton stiff.',
      ]],
      ['img', I('newsletter-d.jpg'), 'Fold, never hang, your knits and fleece – the shoulders stay sharp and the hem stays straight.'],
      ['h2', 'Skip the tumble dryer'],
      ['p', 'The dryer is where shrinkage happens. Reshape the garment while it is still damp, pull the ribbing back to length and dry flat on a rack or towel. A heavyweight hoodie takes a day to dry – it is worth the wait.'],
      ['quote', 'Every fabric we use is washed fifty times in the studio before it reaches you. Treat it gently and it will outlast the trend cycle several times over.', 'Mia Novak, Fabric & Care Editor'],
      ['h2', 'Store it right'],
      ['p', 'Hang shirts and jackets, fold everything that stretches. Cedar blocks keep moths away from knitwear and smell far better than mothballs.'],
      ['shop', ['washed-sand-hoodie', 'core-zip-hoodie'], 'Made to be worn hard'],
      ['tip', 'Pilling?', 'Small bobbles on fleece are loose fibres, not a defect. A fabric comb once a season removes them in two minutes.'],
    ],
    4: [
      ['lead', 'Leather, construction and sole: what separates a sneaker that lasts five years from one that creases in a week – and how to tell the difference in a shop.'],
      ['h2', 'Full-grain or nothing'],
      ['p', 'Look for full-grain leather. It keeps the natural surface of the hide, creases softly and can be conditioned back to life. Corrected-grain leather has been sanded and coated – it looks perfect on day one and cracks along the flex line by month three.'],
      ['img', I('blog-crop.jpg'), 'A clean court profile goes with tailoring, denim and cargos alike.'],
      ['h2', 'Check the sole'],
      ['p', 'A stitched cupsole can be resoled and holds its shape far longer than a glued one. Flip the shoe: if you can see stitching running around the sidewall, it is built to be repaired.'],
      ['ul', [
        'Leather lining breathes and moulds to your foot.',
        'A removable insole means you can swap in your own support.',
        'Waxed cotton laces outlast flat polyester ones.',
      ]],
      ['shop', ['court-leather-sneakers', 'slim-leather-wallet'], 'Leather goods'],
      ['h2', 'Keep them white'],
      ['p', 'A damp cloth after every few wears, a leather balm once a month and cedar shoe trees overnight. That is the whole routine – five minutes a week for a pair that ages instead of dying.'],
      ['quote', 'Clean sneakers are the most underrated upgrade in menswear. They make a tee and jeans look like a decision.', 'Ethan Carter'],
    ],
    5: [
      ['lead', 'From tee to overshirt to bomber: a simple three-layer system for weather that changes its mind four times before lunch.'],
      ['h2', 'Base, mid, shell'],
      ['p', 'Think in three layers. A tee or fine merino as base, an overshirt or knit as mid layer, and a bomber or harrington as shell. Each layer should work on its own, so you can peel back as the day warms up.'],
      ['img', I('hero.jpg'), 'Three layers, three textures, one colour family.'],
      ['h2', 'Vary the texture'],
      ['p', 'Keep textures varied – jersey, brushed twill and nylon – so the outfit reads rich even in one colour. Tonal dressing only looks expensive when the surfaces are different.'],
      ['shop', ['twill-over-jacket', 'harrington-over-jacket'], 'Layer up'],
      ['h2', 'Mind the lengths'],
      ['ul', [
        'Each layer should be slightly shorter than the one beneath it, or clearly longer.',
        'Overshirts work best open, with the base layer just visible at the hem.',
        'Roll sleeves together so cuffs stack neatly.',
      ]],
      ['quote', 'Autumn rewards the person with options. Three good layers beat one heavy coat every time.', 'Mia Novak'],
      ['tip', 'Pack light', 'A merino base layer does the work of two cotton tees on a trip – it stays fresh for days.'],
    ],
    6: [
      ['lead', 'Rise, leg opening and break explained – find the straight-leg jean that works for your build, and learn what to look for before you hem.'],
      ['h2', 'Rise sets the tone'],
      ['p', 'A mid rise sits at the hip and pairs with both tucked and untucked tops. Low rises shorten the leg line; high rises lengthen it but ask for a tucked or cropped top.'],
      ['h2', 'Leg opening and break'],
      ['p', 'A straight leg with a 19–20 cm opening balances chunky sneakers without flaring. For a clean look, aim for a slight break – the hem just kisses the top of your shoe.'],
      ['img', I('newsletter.jpg'), 'Hem with the shoes you wear most – the break changes with the sole height.'],
      ['ul', [
        'No break: cropped, modern, best with low sneakers.',
        'Slight break: the safest choice for most builds.',
        'Full break: relaxed and workwear-inspired, best with boots.',
      ]],
      ['shop', ['raw-selvedge-jeans', 'utility-cargo-pants'], 'Find your fit'],
      ['h2', 'Raw denim moulds to you'],
      ['p', 'Raw denim stretches about half a size in the waist – buy it snug and let it mould to your body. Wait six months before the first wash for the best fades.'],
      ['quote', 'Fit is personal, but proportion is universal. Get the opening right and everything else follows.', 'Ethan Carter'],
    ],
  };

  const comments = {
    1: [
      { name: 'Lucas Meyer', date: '2028-07-09', likes: 14, body: 'The window test is genius. Just checked three tees in my drawer – two of them are going straight to the gym pile.' },
      { name: 'Sara Haddad', date: '2028-07-10', likes: 9, body: 'Would love a follow-up on how this works for women’s fits. I wear the heavyweight tee oversized with a midi skirt and it’s perfect.',
        reply: { name: 'Ethan Carter', body: 'Great idea, Sara – a womenswear styling piece is in the works for next month.' } },
      { name: 'Noah Kim', date: '2028-07-12', likes: 3, body: 'Buying the most-worn colour twice is the best advice I’ve read all year.' },
    ],
    2: [
      { name: 'Hannah Ortiz', date: '2026-06-03', likes: 21, body: 'Did the twelve-piece challenge for a month. Getting ready in the morning genuinely takes half the time.' },
      { name: 'Ali Rezaei', date: '2026-06-05', likes: 6, body: 'Navy and cream base with olive as the accent. Everything matches. Thanks for the push.' },
    ],
    3: [
      { name: 'Grace Lin', date: '2026-05-19', likes: 11, body: 'Half the detergent – who knew! My hoodie feels softer after one wash.' },
      { name: 'Tom Becker', date: '2026-05-21', likes: 4, body: 'Is the fabric comb safe for the merino tees too?',
        reply: { name: 'Mia Novak', body: 'Yes – just use light strokes in one direction and lay the tee flat first.' } },
    ],
    4: [
      { name: 'Daniel Price', date: '2026-05-02', likes: 17, body: 'Two years in with the court sneakers and they have only got better. The cedar trees make a real difference.' },
    ],
    5: [
      { name: 'Eva Rossi', date: '2026-04-14', likes: 8, body: 'The “each layer shorter than the one beneath” rule fixed every outfit I wasn’t sure about.' },
      { name: 'Marco Silva', date: '2026-04-15', likes: 2, body: 'Merino base layer + twill over jacket is my whole autumn now.' },
    ],
    6: [
      { name: 'Kai Andersen', date: '2026-03-29', likes: 12, body: 'Finally understand what a break is. Took my jeans to the tailor this weekend.' },
    ],
  };

  window.VOLIN_JOURNAL = { topics, authors, content, comments };
})();
