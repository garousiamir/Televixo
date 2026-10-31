/*
 * Chio help centre — FAQ content (-> page.content / metaobjects "faq_item" in Shopify).
 * Used by sections/main-faq.html and sections/contact-faq-teaser.html.
 *   category: { id, title, icon (ChioIcons name), blurb }
 *   item:     { id (deep link #id), cat, q, a (HTML, links allowed) }
 */
(function () {
  const categories = [
    { id: 'orders', title: 'Orders', icon: 'bag20', blurb: 'Tracking, changes and cancellations' },
    { id: 'shipping', title: 'Shipping', icon: 'truck', blurb: 'Delivery times, costs and countries' },
    { id: 'returns', title: 'Returns', icon: 'returnBox', blurb: 'Free 30-day returns and exchanges' },
    { id: 'sizing', title: 'Sizing', icon: 'ruler', blurb: 'Fit notes, measurements and advice' },
    { id: 'payment', title: 'Payment', icon: 'card', blurb: 'Cards, wallets, instalments, codes' },
    { id: 'care', title: 'Product care', icon: 'star4', blurb: 'Washing, storing and repairs' },
    { id: 'account', title: 'Account', icon: 'user', blurb: 'Profile, wishlist and newsletter' },
    { id: 'policies', title: 'Policies', icon: 'shield', blurb: 'Privacy, terms and legal' },
  ];

  const items = [
    // Orders
    { id: 'track-order', cat: 'orders', q: 'How do I track my order?',
      a: 'As soon as your parcel leaves our Lisbon studio we email you a tracking link. You can also follow every step from <a href="chio-account.html">your account → Orders</a>, where each order shows a live status timeline: Confirmed, Shipped, Out for delivery and Delivered.' },
    { id: 'change-order', cat: 'orders', q: 'Can I change or cancel my order?',
      a: 'Yes — within <strong>1 hour</strong> of placing it. Reply to your confirmation email or <a href="chio-contact.html">message us</a> with your order number and we will update the size, colour or address, or cancel it for a full refund. After that window your parcel is usually already being packed.' },
    { id: 'order-confirmation', cat: 'orders', q: 'I didn’t receive an order confirmation email.',
      a: 'Confirmation emails arrive within 10 minutes. Check your spam or promotions folder first, then make sure the email address on your account is spelled correctly. Still nothing? Send us your name and the time of purchase and we will resend it.' },
    { id: 'out-of-stock', cat: 'orders', q: 'An item I want is sold out. Will it come back?',
      a: 'Most core pieces are restocked every 6–8 weeks. Save it to your <a href="chio-wishlist.html">wishlist</a> and turn on newsletter emails — we let wishlist customers know first when sizes return.' },
    { id: 'gift-order', cat: 'orders', q: 'Can I send an order as a gift?',
      a: 'Of course. Add gift wrapping in the cart for $5 and include a handwritten note — we never put prices or receipts in gift parcels. The recipient can exchange the size free of charge.' },

    // Shipping
    { id: 'shipping-cost', cat: 'shipping', q: 'How much does shipping cost?',
      a: 'Standard shipping is <strong>free on orders over $150</strong>. Below that it costs $6 in Europe and $12 worldwide. Express delivery (1–2 business days in Europe) is $14. The exact price is always shown in the cart before you pay.' },
    { id: 'delivery-time', cat: 'shipping', q: 'How long will delivery take?',
      a: 'Orders placed before 2 pm (Lisbon time) on a business day leave the same day. Standard delivery takes 2–4 business days in Europe, 4–7 to the UK and US, and 5–10 to the rest of the world.' },
    { id: 'countries', cat: 'shipping', q: 'Which countries do you ship to?',
      a: 'We currently deliver to 34 countries, including all of the EU, the UK, Switzerland, Norway, the United States, Canada, Australia and Japan. If your country is not listed at checkout, write to us — we are adding new destinations every season.' },
    { id: 'duties', cat: 'shipping', q: 'Will I pay customs duties?',
      a: 'Not inside the EU. For the UK, US, Canada and Switzerland duties and taxes are included in the price you see at checkout, so there is nothing extra to pay on delivery. For other destinations local import fees may apply.' },
    { id: 'missing-parcel', cat: 'shipping', q: 'My parcel says delivered but I can’t find it.',
      a: 'Check with neighbours and your building’s reception first — couriers sometimes leave parcels in a safe place. If it still hasn’t appeared after 48 hours, <a href="chio-contact.html">contact us</a> and we will open an investigation with the courier and send a replacement if needed.' },

    // Returns
    { id: 'return-policy', cat: 'returns', q: 'What is your return policy?',
      a: 'You have <strong>30 days</strong> from delivery to return unworn items with their tags attached. Returns are free in Europe, the UK and the US. Refunds go back to your original payment method within 5 business days of the parcel reaching us.' },
    { id: 'start-return', cat: 'returns', q: 'How do I start a return?',
      a: 'Go to <a href="chio-account.html">your account → Orders</a>, choose the order and tap “Return items”. Select the pieces and a reason, then print the prepaid label or show the QR code at any drop-off point. Guest orders can be returned using your order number and email.' },
    { id: 'exchange', cat: 'returns', q: 'Can I exchange for a different size?',
      a: 'Yes. Choose “Exchange” instead of “Refund” when you start your return and pick the new size. We ship the replacement as soon as your return is scanned by the courier — usually before it even reaches us.' },
    { id: 'final-sale', cat: 'returns', q: 'Are sale items returnable?',
      a: 'Sale items can be returned within 14 days for store credit or an exchange. Pieces marked “Final sale” (mostly last sizes and samples) cannot be returned, and this is always shown on the product page.' },

    // Sizing
    { id: 'size-guide', cat: 'sizing', q: 'How do I find my size?',
      a: 'Every product page has a size guide with garment measurements in cm and inches, plus a fit note from our team (e.g. “Oversized — size down for a closer fit”). Our models’ height and the size they wear are listed under each photo.' },
    { id: 'between-sizes', cat: 'sizing', q: 'I’m between two sizes. Which should I choose?',
      a: 'For relaxed pieces like hoodies and sweatshirts, choose the smaller size. For tailoring, dresses and anything with a fitted waist, choose the larger one. Not sure? Send us your usual size and height and a stylist will reply within a few hours.' },
    { id: 'size-consistent', cat: 'sizing', q: 'Are your sizes consistent across products?',
      a: 'Our sizing is based on the same body block, from XS (EU 34) to XXL (EU 44). Fit varies by design — a boxy tee and a rib dress will feel different — so always read the fit note on the product page.' },
    { id: 'shrink', cat: 'sizing', q: 'Will my clothes shrink?',
      a: 'Our cotton and fleece are pre-washed and garment-dyed, so shrinkage stays below 3% if you follow the care label. Wool and linen should never go in the dryer.' },

    // Payment
    { id: 'payment-methods', cat: 'payment', q: 'Which payment methods do you accept?',
      a: 'We accept Visa, Mastercard, American Express, Apple Pay, Google Pay, Shop Pay and PayPal. In selected countries you can also pay with Klarna or Afterpay in 3 interest-free instalments.' },
    { id: 'discount-code', cat: 'payment', q: 'How do I use a discount code?',
      a: 'Enter your code in the discount field in the cart or at checkout and press “Apply”. Only one code can be used per order. New subscribers get <strong>WELCOME10</strong> for 10% off their first order.' },
    { id: 'payment-secure', cat: 'payment', q: 'Is my payment secure?',
      a: 'Yes. Payments are processed by PCI-DSS certified providers with 3-D Secure authentication. We never see or store your full card number.' },
    { id: 'charged-twice', cat: 'payment', q: 'I was charged twice. What should I do?',
      a: 'What looks like a double charge is usually a temporary authorisation that your bank releases within 3–5 business days. If both amounts are still there after that, send us a screenshot and we will sort it out right away.' },

    // Care
    { id: 'wash-knitwear', cat: 'care', q: 'How should I wash knitwear?',
      a: 'Wash wool and alpaca as little as possible — airing between wears is usually enough. When needed, hand wash or use a wool cycle at 30 °C with a wool detergent, never wring, and dry flat on a towel. More tips in our <a href="chio-article.html?id=caring-for-your-knitwear">knitwear care guide</a>.' },
    { id: 'pilling', cat: 'care', q: 'My sweater is pilling. Is that a defect?',
      a: 'Pilling is natural on soft fibres and happens where fabric rubs, like under the arms. A fabric comb removes it in a minute. If a piece pills heavily within the first month, send us a photo — we will replace it.' },
    { id: 'repairs', cat: 'care', q: 'Do you offer repairs?',
      a: 'Yes, through <strong>Chio Again</strong>. Loose buttons, small holes and broken zips are repaired free for the first year, and at cost after that. Start a repair from <a href="chio-contact.html">the contact form</a> by choosing “Product care”.' },
    { id: 'storing', cat: 'care', q: 'How do I store my clothes between seasons?',
      a: 'Clean everything before storing — moths are attracted to body oils. Fold knits instead of hanging them, keep leather in a breathable dust bag and add a cedar block to the drawer.' },

    // Account
    { id: 'create-account', cat: 'account', q: 'Do I need an account to order?',
      a: 'No, you can check out as a guest. An account lets you track orders, start returns in two taps, save addresses and keep your wishlist across devices. <a href="chio-account-login.html">Create one in under a minute</a>.' },
    { id: 'reset-password', cat: 'account', q: 'I forgot my password.',
      a: 'On the <a href="chio-account-login.html">login page</a>, choose “Forgot password?” and enter your email. You will receive a reset link valid for 24 hours.' },
    { id: 'newsletter', cat: 'account', q: 'How do I unsubscribe from emails?',
      a: 'Use the “Unsubscribe” link at the bottom of any email, or switch off marketing emails under <a href="chio-account.html">account → Settings</a>. Order and shipping emails will still reach you.' },
    { id: 'delete-account', cat: 'account', q: 'Can I delete my account?',
      a: 'Yes. Write to <a href="mailto:privacy@chio.store">privacy@chio.store</a> from the email on your account and we will delete it and your personal data within 30 days, keeping only what we are legally required to retain for invoices.' },

    // Policies (footer links: #privacy, #terms)
    { id: 'privacy', cat: 'policies', q: 'Privacy policy — how do you use my data?',
      a: 'We only collect what we need to deliver your order and improve the store: contact details, addresses, order history and anonymous analytics. We never sell your data. You can request a copy or deletion at any time at <a href="mailto:privacy@chio.store">privacy@chio.store</a>.' },
    { id: 'terms', cat: 'policies', q: 'Terms and conditions',
      a: 'By placing an order you agree to our terms of sale: prices include VAT where applicable, a contract is formed when we send your shipping confirmation, and you have a statutory 14-day right of withdrawal on top of our 30-day return policy. Chio Studio Lda., Rua da Rosa 112, 1200-389 Lisbon, Portugal.' },
    { id: 'cookies', cat: 'policies', q: 'Which cookies do you use?',
      a: 'Essential cookies keep your cart and login working. With your consent we also use analytics cookies to understand which pages help you most. You can change your choice at any time from the cookie settings link in the footer.' },
  ];

  window.CHIO_FAQ = { categories, items };
})();
