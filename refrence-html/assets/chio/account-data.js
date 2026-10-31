/*
 * Chio customer account — fake session, sample orders and order normalisation.
 * In Shopify this is `customer`, `customer.orders`, `customer.addresses` (customers/account, order, addresses templates).
 *
 *   ChioAccount.session()            -> { email, first_name, last_name, phone, birthday, created_at, prefs } | null
 *   ChioAccount.signIn(data)         -> stores the session (localStorage "chio:session")
 *   ChioAccount.signOut()
 *   ChioAccount.orders()             -> orders placed through chio-checkout (any "chio:*order*" key) + sample orders, newest first
 *
 * Normalised order: { id, number, date, status: processing|shipped|delivered|cancelled, source, items[{ handle, title, image,
 *   options[], quantity, price, url }], subtotal, discount, discount_code, shipping, shipping_method, tax, total, email,
 *   address{ name, address1, address2, city, province, zip, country, phone }, payment, tracking, timeline[{ label, date, done }] }
 * Money is in cents.
 */
(function () {
  const KEY = 'chio:session';
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const byHandle = (h) => (window.Theme ? window.Theme.byHandle(h) : (window.THEME.products || []).find((p) => p.handle === h));
  const iso = (d) => new Date(d).toISOString();
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* ---------- sample orders (realistic history for the demo customer) ---------- */
  const SAMPLE = [
    { number: '#CH-10482', date: '2026-10-08T10:24:00', status: 'shipped', method: 'Express (1–2 business days)', ship: 1500, tracking: 'DHL 4829 1176 0532',
      lines: [['floral-tea-dress', ['Floral', 'S'], 1], ['metallic-leather-wristlet', ['Gold'], 1]], payment: 'Visa •••• 4242' },
    { number: '#CH-10317', date: '2026-09-21T18:02:00', status: 'delivered', method: 'Standard (3–5 business days)', ship: 0, tracking: 'UPS 1Z 999 AA1 01 2345 6784', code: 'WELCOME10',
      lines: [['cream-puffer-jacket', ['Cream', 'S'], 1], ['vintage-logo-tee', ['Rust', 'M'], 2]], payment: 'Apple Pay' },
    { number: '#CH-10155', date: '2026-08-30T09:41:00', status: 'delivered', method: 'Standard (3–5 business days)', ship: 0, tracking: 'UPS 1Z 999 AA1 01 2211 0457',
      lines: [['suede-western-boots', ['Camel', '38'], 1]], payment: 'Mastercard •••• 8817' },
    { number: '#CH-09983', date: '2026-07-12T14:15:00', status: 'cancelled', method: 'Standard (3–5 business days)', ship: 900,
      lines: [['relaxed-fleece-joggers', ['Heather', 'M'], 1]], payment: 'PayPal' },
  ];

  const DEFAULT_ADDRESS = { name: 'Sara Mitchell', address1: '214 Mercer Street', address2: 'Apt 5B', city: 'New York', province: 'NY', zip: '10012', country: 'United States', phone: '+1 (212) 555-0148' };

  function timeline(status, date) {
    const d = new Date(date);
    const steps = [
      { label: 'Confirmed', date: d },
      { label: 'Shipped', date: addDays(d, 1) },
      { label: 'Out for delivery', date: addDays(d, 3) },
      { label: 'Delivered', date: addDays(d, 4) },
    ];
    const reached = { processing: 1, shipped: 2, delivered: 4, cancelled: 1 }[status] || 1;
    const now = new Date();
    return steps.map((s, i) => {
      /* upcoming steps never show an estimate in the past */
      const when = i >= reached && s.date < now ? addDays(now, i - reached + 1) : s.date;
      return { label: s.label, date: iso(when), done: i < reached, current: i === reached - 1 };
    });
  }

  function totals(o) {
    o.subtotal = o.items.reduce((n, l) => n + l.price * l.quantity, 0);
    return o;
  }

  function sampleOrders(customer) {
    return SAMPLE.map((s, idx) => {
      const items = s.lines.map(([h, opts, q]) => {
        const p = byHandle(h); if (!p) return null;
        return { handle: h, title: p.title, image: p.featured_image, options: opts, quantity: q, price: p.price, url: p.url };
      }).filter(Boolean);
      const o = totals({ id: `s${idx}`, number: s.number, date: s.date, status: s.status, source: 'sample', items, shipping_method: s.method, tracking: s.tracking || '', payment: s.payment });
      o.discount_code = s.code || ''; o.discount = s.code ? Math.round(o.subtotal * 0.1) : 0;
      o.shipping = s.ship; o.tax = Math.round((o.subtotal - o.discount) * 0.08);
      o.total = o.subtotal - o.discount + o.shipping + o.tax;
      o.email = customer ? customer.email : '';
      o.address = { ...DEFAULT_ADDRESS, name: customer ? `${customer.first_name} ${customer.last_name}`.trim() || DEFAULT_ADDRESS.name : DEFAULT_ADDRESS.name };
      o.timeline = timeline(o.status, o.date);
      return o;
    });
  }

  /* ---------- orders written by the checkout (shape unknown → read defensively) ---------- */
  const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };
  /* a value is cents unless it has decimals or is ~100x smaller than a known cent reference */
  const cents = (v, ref) => {
    const n = num(v); if (n === null) return null;
    if (!Number.isInteger(n)) return Math.round(n * 100);
    if (ref && n > 0 && Math.abs(n * 100 - ref) <= ref * 0.6 && n < ref / 20) return n * 100;
    return n;
  };
  const pick = (o, ...keys) => { for (const k of keys) { const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o); if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
  const STATUS = { paid: 'processing', pending: 'processing', confirmed: 'processing', placed: 'processing', processing: 'processing', unfulfilled: 'processing', open: 'processing',
    fulfilled: 'shipped', shipped: 'shipped', in_transit: 'shipped', 'in transit': 'shipped', out_for_delivery: 'shipped', delivered: 'delivered', complete: 'delivered', completed: 'delivered',
    cancelled: 'cancelled', canceled: 'cancelled', refunded: 'cancelled' };

  function normalise(raw, i) {
    if (!raw || typeof raw !== 'object') return null;
    const rawLines = pick(raw, 'items', 'lines', 'line_items', 'cart.items', 'cart.lines', 'products') || [];
    if (!Array.isArray(rawLines) || !rawLines.length) return null;
    const items = rawLines.map((l) => {
      if (!l || typeof l !== 'object') return null;
      const handle = pick(l, 'handle', 'product.handle', 'product_handle') || '';
      const p = handle ? byHandle(handle) : null;
      const v = p && l.variant_id ? p.variants.find((x) => x.id === l.variant_id) : null;
      let options = pick(l, 'options', 'variant.options', 'variant_options');
      if (!Array.isArray(options)) { const t = pick(l, 'variant_title', 'variant.title'); options = t ? String(t).split(/\s*\/\s*/) : (v ? v.options : []); }
      const ref = (v && v.price) || (p && p.price) || null;
      const quantity = Math.max(1, parseInt(pick(l, 'quantity', 'qty'), 10) || 1);
      let price = cents(pick(l, 'price', 'final_price', 'variant.price', 'unit_price'), ref);
      if (price === null) { const lp = cents(pick(l, 'line_price', 'line_total', 'total'), ref ? ref * quantity : null); price = lp !== null ? Math.round(lp / quantity) : (ref || 0); }
      return { handle, title: pick(l, 'title', 'product_title', 'name', 'product.title') || (p && p.title) || 'Item', image: pick(l, 'image', 'featured_image', 'product.featured_image', 'img') || (p && p.featured_image) || '',
        options: options.filter(Boolean), quantity, price, url: (p && p.url) || (handle ? `chio-product.html?handle=${handle}` : 'chio-shop.html') };
    }).filter(Boolean);
    if (!items.length) return null;
    const sub = items.reduce((n, l) => n + l.price * l.quantity, 0);
    const t = (keys, ref) => cents(pick(raw, ...keys), ref);
    const subtotal = t(['subtotal', 'subtotal_price', 'totals.subtotal', 'summary.subtotal'], sub) ?? sub;
    const discount = Math.abs(t(['discount', 'discount_amount', 'total_discounts', 'totals.discount', 'summary.discount'], sub) ?? 0);
    const shipping = t(['shipping', 'shipping_price', 'shipping_cost', 'totals.shipping', 'summary.shipping', 'shipping_method.price', 'shipping.price'], sub) ?? 0;
    const tax = t(['tax', 'total_tax', 'taxes', 'totals.tax', 'summary.tax'], sub) ?? Math.round((subtotal - discount) * 0.08);
    const total = t(['total', 'total_price', 'totals.total', 'summary.total', 'amount'], sub) ?? (subtotal - discount + shipping + tax);
    const date = pick(raw, 'created_at', 'date', 'placed_at', 'processed_at', 'createdAt', 'timestamp') || new Date().toISOString();
    const d = new Date(typeof date === 'number' ? date : String(date));
    const status = STATUS[String(pick(raw, 'status', 'fulfillment_status', 'financial_status') || 'processing').toLowerCase()] || 'processing';
    let number = String(pick(raw, 'number', 'name', 'order_number', 'orderNumber', 'id') || `CH-${11000 + i}`);
    if (!number.startsWith('#')) number = `#${number}`;
    const a = pick(raw, 'shipping_address', 'address', 'delivery', 'shipping.address', 'customer.address') || {};
    const address = typeof a === 'string' ? { name: '', address1: a } : {
      name: a.name || [a.first_name || a.firstName, a.last_name || a.lastName].filter(Boolean).join(' '),
      address1: a.address1 || a.address || a.street || a.line1 || '', address2: a.address2 || a.apartment || a.line2 || '',
      city: a.city || '', province: a.province || a.state || a.region || '', zip: a.zip || a.postal || a.postcode || a.postal_code || '', country: a.country || '', phone: a.phone || '' };
    const pay = pick(raw, 'payment', 'payment_method', 'gateway');
    const payment = typeof pay === 'string' ? pay : pay ? [pay.brand || pay.method || pay.type, pay.last4 ? `•••• ${pay.last4}` : ''].filter(Boolean).join(' ') : 'Card';
    const sm = pick(raw, 'shipping_method', 'shipping.method', 'delivery_method');
    return {
      id: `c${i}-${number}`, number, date: Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(), status, source: 'checkout', items,
      subtotal, discount, discount_code: pick(raw, 'discount_code', 'discount.code', 'code') || '', shipping, tax, total,
      shipping_method: typeof sm === 'string' ? sm : (sm && (sm.title || sm.name || sm.label)) || 'Standard',
      email: pick(raw, 'email', 'contact.email', 'customer.email') || '', address, payment, tracking: pick(raw, 'tracking', 'tracking_number') || '',
      timeline: timeline(status, Number.isNaN(d.getTime()) ? new Date() : d),
    };
  }

  function checkoutOrders() {
    const found = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('chio:') || !/order/i.test(k)) continue;
        let v; try { v = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
        const list = Array.isArray(v) ? v : (v && Array.isArray(v.orders) ? v.orders : [v]);
        list.forEach((o) => { const n = normalise(o, found.length); if (n) found.push(n); });
      }
    } catch (e) { /* storage blocked */ }
    const seen = new Set();
    return found.filter((o) => (seen.has(o.number) ? false : seen.add(o.number)));
  }

  window.ChioAccount = {
    KEY,
    session() { const s = read(KEY, null); return s && s.email ? s : null; },
    signIn(data) {
      const now = new Date().toISOString();
      const prev = read(KEY, null) || {};
      const s = { first_name: '', last_name: '', phone: '', birthday: '', created_at: prev.created_at || now, prefs: { email: true, sms: false, drops: true, restock: true }, ...prev, ...data, signed_in_at: now };
      write(KEY, s); return s;
    },
    update(patch) { const s = { ...(read(KEY, {}) || {}), ...patch }; write(KEY, s); return s; },
    signOut() { const s = read(KEY, null); if (s) write('chio:session_last', { email: s.email, first_name: s.first_name, last_name: s.last_name }); try { localStorage.removeItem(KEY); } catch (e) {} },
    orders() {
      const s = this.session();
      const mine = checkoutOrders();
      const nums = new Set(mine.map((o) => o.number));
      return [...mine, ...sampleOrders(s).filter((o) => !nums.has(o.number))].sort((a, b) => b.date.localeCompare(a.date));
    },
    addresses() {
      const s = this.session();
      const saved = read('chio:addresses', null);
      if (Array.isArray(saved)) return saved;
      const name = s ? `${s.first_name} ${s.last_name}`.trim() : '';
      return [
        { id: 'a1', default: true, label: 'Home', ...DEFAULT_ADDRESS, name: name || DEFAULT_ADDRESS.name },
        { id: 'a2', default: false, label: 'Studio', name: name || DEFAULT_ADDRESS.name, address1: '88 Wythe Avenue', address2: 'Floor 3', city: 'Brooklyn', province: 'NY', zip: '11249', country: 'United States', phone: '+1 (718) 555-0192' },
      ];
    },
    saveAddresses(list) { write('chio:addresses', list); },
    normalise,
  };
})();
