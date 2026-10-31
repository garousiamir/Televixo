/*
 * Volin help-centre content (-> a "FAQ" metaobject / page blocks in Shopify).
 * Used by sections/main-faq.html (full list + search + FAQPage JSON-LD) and sections/contact-faq.html (teaser).
 *   categories[]: { id, title, icon (svg path, 24px grid) }       id doubles as the URL hash (#shipping)
 *   items[]:      { id, cat, q, a[] (paragraphs), popular? }      id is the deep link (#track-order)
 * Links inside answers are plain HTML (rendered with x-html) and only ever come from this trusted file.
 */
window.VOLIN_FAQ = {
  categories: [
    { id: 'orders', title: 'Orders', icon: 'M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z' },
    { id: 'shipping', title: 'Shipping', icon: 'M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM13 16V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1m8-1a1 1 0 0 1-1 1H9m4-1V8a1 1 0 0 1 1-1h2.586a1 1 0 0 1 .707.293l3.414 3.414a1 1 0 0 1 .293.707V16a1 1 0 0 1-1 1h-1m-6-1a1 1 0 0 0 1 1h1' },
    { id: 'returns', title: 'Returns', icon: 'M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6 6-6' },
    { id: 'sizing', title: 'Sizing', icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0-5 5M4 16v4m0 0h4m-4 0 5-5m11 5-5-5m5 5v-4m0 4h-4' },
    { id: 'payment', title: 'Payment', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z' },
    { id: 'care', title: 'Product care', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 'account', title: 'Account', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z' },
    { id: 'policies', title: 'Policies', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z' },
  ],
  items: [
    // ---------- Orders
    { id: 'track-order', cat: 'orders', popular: true, q: 'How do I track my order?',
      a: ['As soon as your parcel leaves our warehouse we email you a tracking link. You can also follow every order step by step under <a href="volin-account.html">My account → Orders</a>.',
        'Tracking usually becomes active within 12 hours of the dispatch email.'] },
    { id: 'change-order', cat: 'orders', q: 'Can I change or cancel my order?',
      a: ['We start packing quickly, so we can change sizes, colours or the delivery address for 60 minutes after you check out. Write to us through the <a href="volin-contact.html#contact-form">contact form</a> with your order number and we’ll sort it.',
        'Once an order has shipped it can no longer be changed – but returns are free and easy.'] },
    { id: 'order-confirmation', cat: 'orders', q: 'I didn’t receive an order confirmation',
      a: ['Confirmations are sent within a few minutes. Check your spam or promotions folder first, then make sure the email address in your account is correct.',
        'Still nothing after an hour? Contact us with the name and email used at checkout and we’ll resend it.'] },
    { id: 'restock', cat: 'orders', q: 'Will sold-out sizes come back?',
      a: ['Most of our core essentials are restocked every 6–8 weeks. Save the piece to your <a href="volin-wishlist.html">wishlist</a> and subscribe to our newsletter – subscribers hear about restocks first.'] },

    // ---------- Shipping
    { id: 'shipping-times', cat: 'shipping', popular: true, q: 'How long does delivery take?',
      a: ['Orders placed before 2 pm (ET) on a working day ship the same day.',
        'Standard US delivery takes 2–4 working days, Express 1–2 working days. Europe and the UK take 3–6 working days, the rest of the world 5–10 working days.'] },
    { id: 'shipping-cost', cat: 'shipping', q: 'How much does shipping cost?',
      a: ['Standard shipping is free on every order over $150. Below that, US standard shipping is a flat $9 and Express is $18.',
        'International rates are calculated at checkout before you pay – no surprises.'] },
    { id: 'international', cat: 'shipping', q: 'Do you ship internationally? What about duties?',
      a: ['We ship to 62 countries. For the EU, UK, Canada and Australia all duties and taxes are included in the price you see at checkout.',
        'For other destinations local import charges may apply and are collected by the carrier on delivery.'] },
    { id: 'lost-parcel', cat: 'shipping', q: 'My tracking hasn’t updated – is my parcel lost?',
      a: ['Tracking can pause for up to 48 hours while a parcel crosses a border or changes carrier. If it hasn’t moved for more than 5 working days, contact us and we’ll open an investigation with the carrier – and reship or refund if it doesn’t turn up.'] },

    // ---------- Returns
    { id: 'return-policy', cat: 'returns', popular: true, q: 'What is your return policy?',
      a: ['You have 30 days from delivery to return unworn items with their original tags attached. Returns are free within the US, UK and EU.',
        'Underwear, socks and items marked “final sale” can’t be returned for hygiene reasons.'] },
    { id: 'start-return', cat: 'returns', q: 'How do I start a return or exchange?',
      a: ['Go to <a href="volin-account.html">My account → Orders</a>, choose the order and select “Return or exchange”. You’ll get a prepaid label and a QR code for drop-off.',
        'Exchanges for a different size are shipped as soon as the carrier scans your return – you don’t have to wait for it to reach us.'] },
    { id: 'refund-time', cat: 'returns', q: 'When will I get my refund?',
      a: ['We refund to your original payment method within 2 working days of receiving your return. Depending on your bank it can take a further 3–5 days to appear on your statement.'] },
    { id: 'damaged-item', cat: 'returns', q: 'My item arrived damaged or faulty',
      a: ['We’re sorry about that. Send us a photo through the <a href="volin-contact.html#contact-form">contact form</a> (you can attach it directly) and we’ll send a replacement straight away – there’s no need to return the faulty piece.'] },

    // ---------- Sizing
    { id: 'size-guide', cat: 'sizing', popular: true, q: 'How do Volin sizes fit?',
      a: ['Our tees, hoodies and knits are cut relaxed and slightly oversized. If you prefer a classic, closer fit, size down one.',
        'Pants and denim are true to size with a mid rise and straight leg. Every product page lists the model’s height and the size they wear.'] },
    { id: 'size-range', cat: 'sizing', q: 'Which sizes do you offer?',
      a: ['Most styles come in XS to XXL. Sneakers come in EU 36 to 46 – if you’re between sizes, take the larger one.'] },
    { id: 'shrinkage', cat: 'sizing', q: 'Will my cotton pieces shrink?',
      a: ['Our heavyweight cotton is garment-washed and pre-shrunk, so you can expect less than 3% shrinkage when washed cold and dried flat as recommended.'] },

    // ---------- Payment
    { id: 'payment-methods', cat: 'payment', q: 'Which payment methods do you accept?',
      a: ['Visa, Mastercard, American Express, PayPal, Apple Pay and Google Pay. All payments are processed over an encrypted connection – we never store your full card details.'] },
    { id: 'discount-code', cat: 'payment', popular: true, q: 'How do I use a discount code?',
      a: ['Enter your code in the cart drawer or on the cart page and select “Apply” – the discount is shown before checkout. New subscribers get 10% off their first order with the code they receive by email.',
        'Only one code can be used per order and codes can’t be applied to gift cards.'] },
    { id: 'pay-later', cat: 'payment', q: 'Can I pay in instalments?',
      a: ['Yes – in the US you can split orders over $50 into four interest-free payments with Shop Pay Installments, chosen at checkout.'] },
    { id: 'currency', cat: 'payment', q: 'Which currency will I be charged in?',
      a: ['Prices are shown and charged in your local currency in 30+ markets. Everywhere else orders are charged in US dollars.'] },

    // ---------- Product care
    { id: 'wash-cotton', cat: 'care', popular: true, q: 'How should I wash heavyweight cotton?',
      a: ['Wash cold (30°C max) and inside out with similar colours. Skip the tumble dryer – reshape while damp and dry flat. Your hoodie will look better in year three than on day one.'] },
    { id: 'leather-care', cat: 'care', q: 'How do I look after leather sneakers and wallets?',
      a: ['Wipe with a damp cloth after a few wears and condition with a neutral leather balm once a month. Let wet leather dry naturally, away from radiators.'] },
    { id: 'repairs', cat: 'care', q: 'Do you offer repairs?',
      a: ['Yes. Our Repair Programme fixes seams, zips and cuffs on any Volin piece for free within the first two years. Get in touch and we’ll send a prepaid label.'] },

    // ---------- Account
    { id: 'create-account', cat: 'account', q: 'Do I need an account to order?',
      a: ['No, guest checkout is always available. An account lets you track orders, start returns in two clicks, save addresses and keep your wishlist across devices – <a href="volin-account-login.html">sign up here</a>.'] },
    { id: 'reset-password', cat: 'account', q: 'I forgot my password',
      a: ['Select “Forgot password?” on the <a href="volin-account-login.html">login page</a> and we’ll email you a reset link that is valid for 24 hours.'] },
    { id: 'delete-account', cat: 'account', q: 'How do I update or delete my account?',
      a: ['You can edit your details and addresses in My account at any time. To delete your account and personal data, send us a request through the contact form – it’s done within 30 days.'] },

    // ---------- Policies (footer: Privacy Policy, Terms & Conditions)
    { id: 'privacy', cat: 'policies', q: 'Privacy policy – how do you use my data?',
      a: ['We only collect what we need to deliver your order, run your account and – if you opt in – send our newsletter. We never sell your data.',
        'Analytics cookies are only set with your consent. You can request a copy or deletion of your data at any time by writing to privacy@volin.store.'] },
    { id: 'terms', cat: 'policies', q: 'Terms & conditions – the short version',
      a: ['Orders are a contract between you and Volin Studio Inc., New York. Prices include applicable taxes where stated, and we reserve the right to cancel orders affected by an obvious pricing error – you’ll always be refunded in full.',
        'Our full terms cover delivery, returns, warranties and governing law (New York, USA).'] },
  ],
};
