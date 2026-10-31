/*
 * Volin customer account demo data + helpers (-> Shopify customer / customer.orders / customer.addresses).
 * Load after assets/volin/catalog.js. Exposes window.VOLIN_ACCOUNT:
 *   session()  / signIn(customer) / signOut()        fake session in localStorage "volin:session"
 *   orders()   sample orders + orders placed by the checkout (any "volin:*order*" key), normalised & newest first
 *   addresses  default sample address book (customer edits persist in "volin:addresses")
 *   tiers      loyalty tiers
 */
(function () {
  const T = window.THEME || { key: 'volin', products: [] };
  const KEY = (k) => `${T.key || 'volin'}:${k}`;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const byHandle = (h) => (T.products || []).find((p) => p.handle === h);
  const DAY = 864e5;

  const addresses = [
    { id: 'a1', first_name: 'Amir', last_name: 'Hosseini', company: '', address1: '214 Mercer Street', address2: 'Apt 5B', city: 'New York', province: 'NY', zip: '10012', country: 'United States', phone: '+1 212 555 0148', default: true },
    { id: 'a2', first_name: 'Amir', last_name: 'Hosseini', company: 'Northline Studio', address1: '88 Wythe Avenue', address2: 'Floor 3', city: 'Brooklyn', province: 'NY', zip: '11249', country: 'United States', phone: '+1 718 555 0192', default: false },
  ];

  const tiers = [
    { name: 'Member', min: 0, perk: '1 point per $1 · birthday gift' },
    { name: 'Insider', min: 500, perk: 'Free express shipping · early access' },
    { name: 'Studio', min: 1500, perk: 'Free alterations · private sales' },
  ];

  // sample order lines: [handle, variant index, qty]
  const SAMPLE = [
    { n: 1052, days: 2, status: 'processing', lines: [['washed-sand-hoodie', 2, 1], ['merino-crew-tee', 3, 2]], method: 'Express (1–2 business days)', ship: 1500, code: null, pay: 'Visa •••• 4242' },
    { n: 1047, days: 6, status: 'shipped', lines: [['court-leather-sneakers', 2, 1], ['slim-leather-wallet', 0, 1]], method: 'Standard (3–5 business days)', ship: 0, code: 'WELCOME10', pay: 'Apple Pay', tracking: '1Z 999 AA1 01 2345 6784' },
    { n: 1031, days: 24, status: 'delivered', lines: [['core-zip-hoodie', 2, 1], ['utility-cargo-pants', 3, 1], ['heavyweight-boxy-tee', 2, 2]], method: 'Standard (3–5 business days)', ship: 0, code: null, pay: 'Mastercard •••• 8812', tracking: '1Z 999 AA1 01 2345 1190' },
    { n: 1012, days: 71, status: 'delivered', lines: [['twill-over-jacket', 1, 1]], method: 'Standard (3–5 business days)', ship: 900, code: null, pay: 'PayPal', tracking: '1Z 999 AA1 01 2344 0021' },
    { n: 1006, days: 96, status: 'cancelled', lines: [['nylon-bomber-jacket', 3, 1]], method: 'Standard (3–5 business days)', ship: 900, code: null, pay: 'Visa •••• 4242' },
  ];

  const lineFrom = (handle, vi, qty) => {
    const p = byHandle(handle); if (!p) return null;
    const v = p.variants[vi] || p.variants[0];
    return { handle, variant_id: v.id, title: p.title, image: p.featured_image, options: v.options, quantity: qty, price: v.price, compare_at_price: v.compare_at_price, url: p.url };
  };

  const totals = (items, ship, pct) => {
    const subtotal = items.reduce((n, l) => n + l.price * l.quantity, 0);
    const discount = pct ? Math.round(subtotal * pct / 100) : 0;
    const tax = Math.round((subtotal - discount) * 0.08);
    return { subtotal, discount, shipping: ship, tax, total: subtotal - discount + ship + tax };
  };

  function samples() {
    const now = Date.now();
    return SAMPLE.map((s) => {
      const items = s.lines.map((l) => lineFrom(...l)).filter(Boolean);
      return {
        id: 'S' + s.n, name: '#' + s.n, created_at: new Date(now - s.days * DAY - 3.6e6 * 5).toISOString(), status: s.status,
        items, ...totals(items, s.ship, s.code ? 10 : 0), discount_code: s.code, shipping_method: s.method, payment: s.pay,
        tracking: s.tracking || '', shipping_address: addresses[s.n % 2 ? 0 : 1], email: '', source: 'sample',
      };
    });
  }

  /* ---- defensive normaliser for orders written by other pages (checkout) ---- */
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const cents = (v) => { if (v == null) return null; if (typeof v === 'string') { const n = parseFloat(v.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? (v.includes('.') ? Math.round(n * 100) : n) : null; } return num(v); };
  const STATUS = { confirmed: 'processing', paid: 'processing', pending: 'processing', processing: 'processing', placed: 'processing', open: 'processing',
    fulfilled: 'shipped', shipped: 'shipped', in_transit: 'shipped', out_for_delivery: 'out_for_delivery', delivered: 'delivered', cancelled: 'cancelled', canceled: 'cancelled', refunded: 'cancelled' };

  function normItem(i) {
    if (!i || typeof i !== 'object') return null;
    const handle = i.handle || (i.product && i.product.handle) || '';
    const p = byHandle(handle);
    const vid = i.variant_id ?? (i.variant && i.variant.id) ?? i.id;
    const v = p ? (p.variants.find((x) => x.id === vid) || p.variants[0]) : null;
    const qty = num(i.quantity ?? i.qty) || 1;
    let price = cents(i.price ?? i.final_price ?? (i.variant && i.variant.price));
    if (price == null && i.line_price != null) price = Math.round(cents(i.line_price) / qty);
    if (price == null) price = v ? v.price : 0;
    return {
      handle, variant_id: v ? v.id : vid, title: i.title || i.product_title || (p && p.title) || 'Item',
      image: i.image || i.featured_image || (p && p.featured_image) || 'assets/images/volin/featured.webp',
      options: i.options || (i.variant_title ? String(i.variant_title).split(' / ') : v ? v.options : []),
      quantity: qty, price, compare_at_price: v ? v.compare_at_price : null, url: p ? p.url : '#',
    };
  }

  function normOrder(o, key, idx) {
    if (!o || typeof o !== 'object') return null;
    const rawItems = o.items || o.line_items || o.lines || (o.cart && (o.cart.items || o.cart.lines)) || [];
    if (!Array.isArray(rawItems) || !rawItems.length) return null;
    const items = rawItems.map(normItem).filter(Boolean);
    if (!items.length) return null;
    const subtotal = cents(o.subtotal ?? o.subtotal_price ?? (o.totals && o.totals.subtotal)) ?? items.reduce((n, l) => n + l.price * l.quantity, 0);
    const discount = cents(o.discount && typeof o.discount === 'object' ? o.discount.amount : (o.discount ?? o.discountAmount ?? o.total_discounts ?? (o.totals && o.totals.discount))) || 0;
    const shippingRaw = o.shipping_price ?? o.shipping_cost ?? (typeof o.shipping === 'number' || typeof o.shipping === 'string' ? o.shipping : null) ?? (o.totals && o.totals.shipping) ?? (o.shipping_method && o.shipping_method.price) ?? (o.shipping && o.shipping.price);
    const shipping = cents(shippingRaw) || 0;
    const tax = cents(o.tax ?? o.total_tax ?? (o.totals && o.totals.tax)) ?? Math.round((subtotal - discount) * 0.08);
    const total = cents(o.total ?? o.total_price ?? (o.totals && o.totals.total)) ?? subtotal - discount + shipping + tax;
    const a = o.shipping_address || o.address || (o.shipping && typeof o.shipping === 'object' && (o.shipping.address || o.shipping)) || o.delivery || o.customer || {};
    const name = String(o.name || o.number || o.order_number || o.id || (1100 + idx));
    const date = new Date(o.created_at || o.createdAt || o.date || o.placed_at || o.processed_at || Date.now());
    const method = o.shipping_line && o.shipping_line.title ? o.shipping_line.title + (o.shipping_line.eta ? ` (${o.shipping_line.eta})` : '') : o.shipping_method && typeof o.shipping_method === 'object' ? (o.shipping_method.title || o.shipping_method.name) : (o.shipping_method || o.shippingMethod || (o.shipping && o.shipping.title) || 'Standard shipping');
    const pay = o.payment && typeof o.payment === 'object' ? (o.payment.label || (o.payment.brand ? `${o.payment.brand} •••• ${o.payment.last4 || ''}` : o.payment.method)) : (o.payment || o.payment_method || 'Card');
    return {
      id: 'C' + String(o.id || o.number || name).replace(/[^\w-]/g, '') + '-' + idx, name: name.startsWith('#') ? name : '#' + name.replace(/^VL-?/i, ''),
      created_at: isNaN(date) ? new Date().toISOString() : date.toISOString(), status: STATUS[String(o.status || o.fulfillment_status || '').toLowerCase()] || 'processing',
      items, subtotal, discount, shipping, tax, total, discount_code: o.discount_code || (o.discount && o.discount.code) || null,
      shipping_method: String(method), payment: String(pay), tracking: o.tracking || o.tracking_number || '',
      shipping_address: {
        first_name: a.first_name || a.firstName || (a.name || '').split(' ')[0] || '', last_name: a.last_name || a.lastName || (a.name || '').split(' ').slice(1).join(' ') || '',
        address1: a.address1 || a.address || a.street || '', address2: a.address2 || a.apartment || '', city: a.city || '', province: a.province || a.state || '', zip: a.zip || a.postal || a.postcode || '', country: a.country || '',
      },
      email: o.email || (o.customer && o.customer.email) || '', source: 'checkout', number: String(o.number || ''),
    };
  }

  function checkoutOrders() {
    const out = [];
    try {
      const prefix = (T.key || 'volin') + ':';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(prefix) || !/order/i.test(k)) continue;
        let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
        const list = Array.isArray(v) ? v : v && Array.isArray(v.orders) ? v.orders : [v];
        list.forEach((o) => { const n = normOrder(o, k, out.length); if (n) out.push(n); });
      }
    } catch (e) { /* storage blocked */ }
    // de-duplicate (same order may be stored under "last_order" and "orders")
    const seen = new Set();
    return out.filter((o) => { const sig = o.name + '|' + o.total; if (seen.has(sig)) return false; seen.add(sig); return true; });
  }

  const orders = () => {
    const local = load('orders_cancelled', []);
    return [...checkoutOrders(), ...samples()]
      .map((o) => (local.includes(o.id) ? { ...o, status: 'cancelled' } : o))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  };

  window.VOLIN_ACCOUNT = {
    addresses, tiers, orders, load, save,
    // fake session lives in "volin:session" (shared with checkout / order confirmation)
    session: () => load('session', null),
    signIn: (c) => save('session', { ...c, signed_in_at: new Date().toISOString() }),
    signOut: () => { try { localStorage.removeItem(KEY('session')); } catch (e) { /* ignore */ } },
  };
})();
