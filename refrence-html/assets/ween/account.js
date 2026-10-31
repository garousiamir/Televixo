/*
 * Ween customer account data (-> Shopify customer object: customer.orders, customer.addresses, metafields for points/prefs).
 * Loaded by section main-account as a plain <script> before Alpine.
 *
 * localStorage (prefix "ween:"):
 *   customer               fake session written by main-account-login  { first_name, last_name, email, phone, birthday, created_at }
 *   account_addresses      [address]          address = { id, first_name, last_name, company, address1, address2, city, province, zip, country, phone, default }
 *   account_prefs          { email, sms, drops, restock, orders }
 *   *order*                any key containing "order" written by the checkout (array of orders, or { orders: [] }, or a single order) — read defensively
 *
 * WeenAccount.orders()     checkout orders (normalised) + sample orders, newest first
 */
(function () {
  const T = window.THEME || { products: [] };
  const byHandle = (h) => (T.products || []).find((p) => p.handle === h);

  // ---- sample order history (handles + variant option values only; prices come from the catalog) ----
  const SAMPLE = [
    { number: 'WN-10418', created_at: '2026-10-11T15:24:00', status: 'processing', lines: [['crimson-lace-bra', ['Crimson', '34B'], 1], ['rouge-lace-thong', null, 1]], code: 'WEEN10', ship: 'Express · 1–2 business days', shipping: 1500 },
    { number: 'WN-10377', created_at: '2026-09-28T10:05:00', status: 'shipped', lines: [['midnight-lace-babydoll', null, 1], ['scarlet-lace-garter-set', null, 1], ['sheer-mesh-bralette', null, 1]], ship: 'Standard · 3–5 business days', shipping: 0, tracking: '1Z 84E 6A0 03 9124 5530' },
    { number: 'WN-10291', created_at: '2026-08-17T19:41:00', status: 'delivered', lines: [['cloud-lounge-set', null, 1], ['cherry-cotton-brief', null, 2]], ship: 'Standard · 3–5 business days', shipping: 900, tracking: '1Z 84E 6A0 03 8811 0042' },
    { number: 'WN-10204', created_at: '2026-06-30T12:12:00', status: 'delivered', lines: [['noir-balconette-set', null, 1], ['elegant-lace-bralette', null, 1]], code: 'WELCOME15', ship: 'Standard · 3–5 business days', shipping: 0, tracking: '1Z 84E 6A0 03 7702 1198' },
    { number: 'WN-10162', created_at: '2026-05-22T09:30:00', status: 'cancelled', lines: [['fishnet-lace-bodysuit', null, 1]], ship: 'Standard · 3–5 business days', shipping: 900 },
  ];

  const ADDRESS = { first_name: 'Sofia', last_name: 'Martin', company: '', address1: '214 Mercer Street', address2: 'Apt 5B', city: 'New York', province: 'New York', zip: '10012', country: 'United States', phone: '+1 (212) 555-0148' };
  const addresses = [
    { id: 'addr-home', ...ADDRESS, default: true },
    { id: 'addr-studio', first_name: 'Sofia', last_name: 'Martin', company: 'Atelier Nord', address1: '88 Wythe Avenue', address2: 'Floor 3', city: 'Brooklyn', province: 'New York', zip: '11249', country: 'United States', phone: '+1 (718) 555-0190', default: false },
  ];

  const lineFrom = ([handle, opts, qty]) => {
    const p = byHandle(handle); if (!p) return null;
    const v = (opts && p.variants.find((x) => x.options.join('|') === opts.join('|'))) || p.variants.find((x) => x.available) || p.variants[0];
    return { handle, title: p.title, variant_title: v.options.join(' / '), image: p.featured_image, cutout: p.cutout, url: p.url, quantity: qty,
      price: v.price, compare_at_price: v.compare_at_price, line_price: v.price * qty, variant_id: v.id };
  };

  const sample = () => SAMPLE.map((o) => {
    const lines = o.lines.map(lineFrom).filter(Boolean);
    const subtotal = lines.reduce((n, l) => n + l.line_price, 0);
    const pct = o.code ? (T.discount_codes || {})[o.code] || 10 : 0;
    const discount = pct ? { code: o.code, percent: pct, amount: Math.round(subtotal * pct / 100) } : null;
    const tax = Math.round((subtotal - (discount ? discount.amount : 0)) * 0.08);
    return { number: o.number, name: `#${o.number}`, created_at: o.created_at, status: o.status, lines, subtotal, discount,
      shipping: o.shipping, tax, total: subtotal - (discount ? discount.amount : 0) + o.shipping + tax,
      shipping_line: { title: o.ship }, shipping_address: ADDRESS, payment: { label: 'Visa •••• 4242' },
      tracking: o.tracking ? { carrier: 'UPS', number: o.tracking } : null, source: 'sample' };
  });

  // ---- checkout orders: any "ween:*order*" key, any reasonable shape ----
  const num = (x) => (typeof x === 'number' && isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && !isNaN(+x) ? +x : null);
  const cents = (x) => { const n = num(x); return n == null ? null : (Number.isInteger(n) && n >= 100 ? n : Math.round(n * 100)); };
  const STATUS = { confirmed: 'processing', paid: 'processing', pending: 'processing', open: 'processing', processing: 'processing', placed: 'processing',
    fulfilled: 'shipped', shipped: 'shipped', in_transit: 'shipped', delivered: 'delivered', cancelled: 'cancelled', canceled: 'cancelled', refunded: 'cancelled' };

  const normLine = (l) => {
    if (!l || typeof l !== 'object') return null;
    const p = byHandle(l.handle || (l.product && l.product.handle));
    const qty = num(l.quantity ?? l.qty) || 1;
    const price = cents(l.price ?? (l.variant && l.variant.price)) ?? (p ? p.price : 0);
    return { handle: l.handle || (p && p.handle) || '', title: l.title || (p && p.title) || 'Item',
      variant_title: l.variant_title || (Array.isArray(l.options) ? l.options.join(' / ') : '') || '',
      image: l.image || l.featured_image || (p && p.featured_image) || '', cutout: p ? p.cutout : false, url: l.url || (p && p.url) || '#',
      quantity: qty, price, compare_at_price: cents(l.compare_at_price), line_price: cents(l.line_price) ?? price * qty, variant_id: l.variant_id || (l.variant && l.variant.id) || null };
  };

  const normAddr = (a) => (a && typeof a === 'object' ? { first_name: a.first_name || a.first || '', last_name: a.last_name || a.last || '', company: a.company || '',
    address1: a.address1 || '', address2: a.address2 || '', city: a.city || '', province: a.province || a.region || '', zip: a.zip || '',
    country: a.country_name || a.country || '', phone: a.phone || '' } : null);

  const normOrder = (o) => {
    if (!o || typeof o !== 'object') return null;
    const id = o.number || o.order_number || o.id || o.name;
    const rawLines = o.lines || o.line_items || o.items || [];
    if (!id || !Array.isArray(rawLines)) return null;
    const lines = rawLines.map(normLine).filter(Boolean);
    const subtotal = cents(o.subtotal ?? o.subtotal_price) ?? lines.reduce((n, l) => n + l.line_price, 0);
    const d = o.discount;
    const discount = d && typeof d === 'object' ? { code: d.code || '', percent: d.percent || 0, amount: cents(d.amount) || 0 } : null;
    const shipping = cents(typeof o.shipping === 'object' && o.shipping ? o.shipping.price : o.shipping ?? ((o.shipping_line || o.shipping_method || {}).price)) || 0;
    const tax = cents(o.tax ?? o.total_tax) || 0;
    const total = cents(o.total ?? o.total_price) ?? subtotal - (discount ? discount.amount : 0) + shipping + tax;
    const pay = o.payment || {};
    const number = String(id).replace(/^#/, '');
    return { number, name: `#${number}`, created_at: o.created_at || o.date || o.createdAt || o.placed_at || new Date().toISOString(),
      status: STATUS[String(o.status || o.fulfillment_status || 'processing').toLowerCase()] || 'processing', lines, subtotal, discount, shipping, tax, total,
      shipping_line: o.shipping_line || (o.shipping_method && typeof o.shipping_method === 'object' ? o.shipping_method : null)
        || (o.shipping && typeof o.shipping === 'object' ? o.shipping : { title: typeof o.shipping_method === 'string' ? o.shipping_method : 'Standard shipping' }),
      shipping_address: normAddr(o.shipping_address || o.address),
      payment: { label: pay.label || (pay.brand && pay.last4 ? `${pay.brand} •••• ${pay.last4}` : ({ card: 'Card', paypal: 'PayPal', klarna: 'Klarna', shop_pay: 'Shop Pay', apple_pay: 'Apple Pay', google_pay: 'Google Pay' })[pay.method] || pay.brand || pay.method || 'Card') },
      tracking: o.tracking || null, email: o.email || '', source: 'checkout' };
  };

  const checkoutOrders = () => {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('ween:') || !/order/i.test(k)) continue;
        let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
        const arr = Array.isArray(v) ? v : v && Array.isArray(v.orders) ? v.orders : v && typeof v === 'object' ? [v] : [];
        arr.forEach((o) => { const n = normOrder(o); if (n && n.lines.length) out.push(n); });
      }
    } catch (e) { /* storage blocked */ }
    return out;
  };

  const orders = () => {
    const seen = new Set();
    return [...checkoutOrders(), ...sample()].filter((o) => (seen.has(o.number) ? false : seen.add(o.number)))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  };

  const tiers = [
    { name: 'Lace', min: 0, perk: 'Birthday gift & free returns' },
    { name: 'Silk', min: 500, perk: 'Free express shipping & early access' },
    { name: 'Velvet', min: 1500, perk: 'Private stylist & 20% birthday code' },
  ];

  window.WeenAccount = { orders, sampleAddresses: addresses, tiers, normOrder,
    countries: ['United States', 'Canada', 'United Kingdom', 'France', 'Germany', 'Netherlands', 'Australia'] };
})();
