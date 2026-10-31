/*
 * Ween FAQ content (-> Shopify: page.faq metaobjects / section blocks). Used by sections/main-faq.html and
 * sections/contact-faq-teaser.html. Answers are plain HTML (links allowed). Every question has a stable `id`
 * so it can be deep-linked: ween-faq.html#q-<id>. Category ids double as anchors (#shipping, #returns…).
 */
window.WEEN_FAQ = {
  categories: [
    { id: 'orders', title: 'Orders' },
    { id: 'shipping', title: 'Shipping' },
    { id: 'returns', title: 'Returns' },
    { id: 'sizing', title: 'Sizing' },
    { id: 'payment', title: 'Payment' },
    { id: 'care', title: 'Product care' },
    { id: 'account', title: 'Account' },
    { id: 'privacy', title: 'Privacy & terms', aliases: ['terms'] },
  ],
  items: [
    // ---------- Orders
    { id: 'change-order', cat: 'orders', q: 'Can I change or cancel my order after placing it?',
      a: 'Yes — within <strong>1 hour</strong> of checkout. Our atelier packs orders quickly, so reach out right away through the <a href="ween-contact.html">contact form</a> or live chat with your order number. Once a parcel has been handed to the courier we can no longer edit it, but you can still return unworn pieces.' },
    { id: 'track-order', cat: 'orders', q: 'How do I track my order?',
      a: 'As soon as your parcel leaves our studio you receive an email with a tracking link. You can also follow every order from <a href="ween-account.html">your account</a> under “Orders”. Tracking usually becomes active within 12 hours of dispatch.' },
    { id: 'out-of-stock', cat: 'orders', q: 'A size is sold out — will it come back?',
      a: 'Most core styles are restocked every 4–6 weeks. Tap the heart to add the piece to your <a href="ween-wishlist.html">wishlist</a> and we will let you know as soon as your size is back. Limited editions are marked as such on the product page and are not restocked.' },
    { id: 'gift', cat: 'orders', q: 'Can I send an order as a gift?',
      a: 'Of course. Add a note in the cart and choose a different shipping address at checkout. Gift orders never include prices — the packing slip only shows the items, and every order arrives in our signature black tissue and keepsake box.' },

    // ---------- Shipping
    { id: 'discreet-shipping', cat: 'shipping', q: 'Is my parcel discreet?',
      a: 'Always. Orders ship in a <strong>plain, unbranded mailer</strong> with no product names on the label — the sender reads “WN Studio”. Card statements show “WN STUDIO LTD”. What is inside stays between you and us.' },
    { id: 'shipping-times', cat: 'shipping', q: 'How long does delivery take?',
      a: 'Orders placed before 2 pm (Mon–Fri) leave the studio the same day. <strong>Standard</strong>: 2–4 business days. <strong>Express</strong>: next business day. <strong>International</strong>: 4–9 business days depending on the destination.' },
    { id: 'shipping-cost', cat: 'shipping', q: 'How much does shipping cost?',
      a: 'Standard shipping is <strong>free on orders over $150</strong>; below that it is $6.90. Express is $14.90. International rates are calculated at checkout before you pay — no surprises.' },
    { id: 'international', cat: 'shipping', q: 'Do you ship internationally? Will I pay duties?',
      a: 'We ship to 38 countries. For the EU, UK, US and Canada duties are prepaid at checkout (DDP), so nothing is due on delivery. For other destinations local import taxes may apply and are collected by the courier.' },

    // ---------- Returns
    { id: 'return-policy', cat: 'returns', q: 'What is your return policy?',
      a: 'You have <strong>30 days</strong> from delivery to return unworn pieces with the hygiene liner and original tags attached. Returns are free within the US and EU — start one from <a href="ween-account.html">your account</a> and print the prepaid label.' },
    { id: 'hygiene', cat: 'returns', q: 'Can I return briefs, thongs and bodysuits?',
      a: 'For hygiene reasons, briefs, thongs and bodysuits can only be returned if the <strong>protective hygiene liner is intact</strong> and the item is unworn and unwashed. Please try them on over your own underwear. Pieces that were worn, washed or have a removed liner cannot be accepted — this protects every customer.' },
    { id: 'final-sale', cat: 'returns', q: 'Are sale items returnable?',
      a: 'Items reduced by up to 40% follow our normal 30-day policy. Pieces marked <strong>Final sale</strong> (reduced by more than 40%) can be exchanged for another size but not refunded.' },
    { id: 'exchange', cat: 'returns', q: 'How do exchanges work?',
      a: 'Choose “Exchange” when you start a return and pick the new size or colour. We ship the replacement as soon as your return is scanned by the courier, so you are not left waiting — and exchanges are always free.' },
    { id: 'refund-time', cat: 'returns', q: 'When will I receive my refund?',
      a: 'Refunds are issued to your original payment method within 3 business days of your parcel arriving at our studio. Your bank may take a further 2–5 days to show it.' },

    // ---------- Sizing
    { id: 'bra-fitting', cat: 'sizing', q: 'How do I measure my bra size at home?',
      a: 'You only need a soft tape measure and an unpadded bra.<ol><li><strong>Band</strong> — measure snugly around your ribcage, directly under the bust, keeping the tape level. Round to the nearest even number (31.5″ → 32).</li><li><strong>Bust</strong> — measure loosely around the fullest part of your bust.</li><li><strong>Cup</strong> — subtract band from bust: 1″ = A, 2″ = B, 3″ = C, 4″ = D.</li></ol>Example: band 34″ and bust 37″ → <strong>34C</strong>.' },
    { id: 'fit-check', cat: 'sizing', q: 'How should a well-fitting bra feel?',
      a: 'The band sits level and does most of the support work — you should fit two fingers underneath on the loosest hook. The centre gore lies flat against your sternum, the cups have no gaps or spilling, and straps stay put without digging in. A new bra should be fastened on the loosest hook so you can tighten it as the elastic relaxes.' },
    { id: 'between-sizes', cat: 'sizing', q: 'I am between sizes — which should I choose?',
      a: 'For bras, try your <strong>sister size</strong>: go one band size up and one cup size down (34B → 36A) for a looser band, or the reverse for a firmer one. Our lace bralettes are stretchy, so between S and M we recommend the smaller size; for garter belts and bodysuits choose the larger.' },
    { id: 'size-chart', cat: 'sizing', q: 'How do your S / M / L sizes convert?',
      a: '<table><thead><tr><th>Ween</th><th>Bra</th><th>UK</th><th>EU</th></tr></thead><tbody><tr><td>XS</td><td>30A–32B</td><td>6</td><td>34</td></tr><tr><td>S</td><td>32B–34B</td><td>8</td><td>36</td></tr><tr><td>M</td><td>34B–36C</td><td>10–12</td><td>38–40</td></tr><tr><td>L</td><td>36C–38C</td><td>14</td><td>42</td></tr><tr><td>XL</td><td>38C–40D</td><td>16</td><td>44</td></tr></tbody></table>Every product page also lists the garment measurements.' },
    { id: 'fit-advice', cat: 'sizing', q: 'Can someone help me find my size?',
      a: 'Yes — our fit stylists answer within a few hours. Send your band and bust measurements (and the style you love) through the <a href="ween-contact.html?topic=sizing">contact form</a> or live chat and we will recommend a size, at no obligation.' },

    // ---------- Payment
    { id: 'payment-methods', cat: 'payment', q: 'Which payment methods do you accept?',
      a: 'Visa, Mastercard, American Express, PayPal, Apple Pay and Google Pay. All payments are processed over an encrypted connection — we never store your card details.' },
    { id: 'discount-codes', cat: 'payment', q: 'How do I use a discount code?',
      a: 'Enter your code in the cart or at checkout and the discount is applied instantly. One code per order. New to Ween? Join our newsletter for <strong>15% off</strong> your first order.' },
    { id: 'currency', cat: 'payment', q: 'Which currency will I be charged in?',
      a: 'Prices are shown in USD by default. Your bank converts the amount at its daily rate; local-currency checkout for EUR and GBP is coming this season.' },

    // ---------- Product care
    { id: 'wash-lace', cat: 'care', q: 'How do I wash lace lingerie?',
      a: 'Hand wash in cool water (30 °C max) with a mild, enzyme-free detergent, fasten hooks first and never wring. Press out water in a towel and lay flat to dry, away from direct heat. If you must machine wash, use a mesh bag on a delicate cycle.' },
    { id: 'bra-life', cat: 'care', q: 'How long will my bra last?',
      a: 'With rotation and gentle washing, 9–12 months of regular wear. Give each bra a day of rest between wears so the elastic recovers, and store moulded cups nested — never folded in half.' },
    { id: 'colour-care', cat: 'care', q: 'Will the crimson and red shades bleed?',
      a: 'All reds are colour-fixed, but rich dyes can release a little colour in the first wash. Wash them separately in cold water the first two times.' },

    // ---------- Account
    { id: 'create-account', cat: 'account', q: 'Do I need an account to order?',
      a: 'No — guest checkout is always available. An <a href="ween-account-login.html">account</a> lets you track orders, start returns in two clicks, save addresses and sync your wishlist across devices.' },
    { id: 'reset-password', cat: 'account', q: 'I forgot my password. What do I do?',
      a: 'Select “Forgot password?” on the <a href="ween-account-login.html">sign-in page</a> and we will email you a secure reset link that is valid for 24 hours.' },
    { id: 'newsletter', cat: 'account', q: 'How do I unsubscribe from emails?',
      a: 'Use the “Unsubscribe” link at the bottom of any email, or update your preferences in your account. Order and shipping emails are always sent.' },

    // ---------- Privacy & terms
    { id: 'data-privacy', cat: 'privacy', q: 'How do you use my personal data?',
      a: 'Only to process your orders, provide customer care and — if you opt in — send you news. We never sell your data, and you can request a copy or deletion of it at any time by writing to <a href="mailto:privacy@ween.store">privacy@ween.store</a>.' },
    { id: 'cookies', cat: 'privacy', q: 'Which cookies do you use?',
      a: 'Essential cookies keep your cart and sign-in working. Analytics and marketing cookies are only set with your consent, which you can change from the cookie banner at any time.' },
    { id: 'terms', cat: 'privacy', q: 'Where can I read your terms & conditions?',
      a: 'Our terms cover orders, pricing, delivery, returns and liability in plain language. In short: you have 30 days to return unworn pieces, prices include VAT where applicable, and we always honour the price shown at checkout. For a full copy, email <a href="mailto:hello@ween.store">hello@ween.store</a>.' },
  ],
};
