/*
 * Chio — cart & checkout helpers (static stand-in for Shopify's shipping rates, address autocomplete and order objects).
 * Loaded by sections/main-cart, main-checkout, main-order-confirmation (guarded, safe to include more than once).
 *
 *   ChioCheckout.countries                 [{ code, name, zipLabel, zip: RegExp, zipHint, regions?[] }]
 *   ChioCheckout.rates(subtotalAfterDiscount, countryCode) -> [{ id, title, desc, price, from, to }]
 *   ChioCheckout.eta(daysFrom, daysTo)     -> "Thu, Oct 16 – Mon, Oct 20" (business days from today)
 *   ChioCheckout.addresses                 sample autocomplete suggestions
 *   ChioCheckout.totals(cart, { shipping, gift }) -> { subtotal, discount, gift, shipping, tax, total }
 *   ChioOrders.all() / get(id) / last() / save(order)   orders persisted in localStorage "chio:orders"
 *   Alpine.store('chioGift')  { on, message, price, toggle(), persist() }  gift wrap persisted in "chio:gift_wrap"
 */
(function () {
  if (window.ChioCheckout) return;
  const KEY = (k) => `${(window.THEME && window.THEME.key) || 'chio'}:${k}`;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* private mode */ } };

  const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
  const countries = [
    { code: 'US', name: 'United States', zipLabel: 'ZIP code', zip: /^\d{5}(-\d{4})?$/, zipHint: 'e.g. 10012', regionLabel: 'State', regions: US_STATES, phone: '+1' },
    { code: 'CA', name: 'Canada', zipLabel: 'Postal code', zip: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, zipHint: 'e.g. M5V 2T6', regionLabel: 'Province', regions: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'], phone: '+1' },
    { code: 'GB', name: 'United Kingdom', zipLabel: 'Postcode', zip: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, zipHint: 'e.g. SW1A 1AA', phone: '+44' },
    { code: 'DE', name: 'Germany', zipLabel: 'Postal code', zip: /^\d{5}$/, zipHint: 'e.g. 10115', phone: '+49' },
    { code: 'FR', name: 'France', zipLabel: 'Postal code', zip: /^\d{5}$/, zipHint: 'e.g. 75003', phone: '+33' },
    { code: 'NL', name: 'Netherlands', zipLabel: 'Postal code', zip: /^\d{4}\s?[A-Za-z]{2}$/, zipHint: 'e.g. 1012 AB', phone: '+31' },
    { code: 'AU', name: 'Australia', zipLabel: 'Postcode', zip: /^\d{4}$/, zipHint: 'e.g. 2000', regionLabel: 'State/territory', regions: ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'], phone: '+61' },
  ];
  const country = (code) => countries.find((c) => c.code === code) || countries[0];

  /* business-day arithmetic for delivery estimates */
  const addBusinessDays = (d, n) => { const x = new Date(d); let left = n; while (left > 0) { x.setDate(x.getDate() + 1); const w = x.getDay(); if (w !== 0 && w !== 6) left--; } return x; };
  const fmt = (d, o = { weekday: 'short', month: 'short', day: 'numeric' }) => d.toLocaleDateString('en-US', o);
  const eta = (from, to, start = new Date()) => {
    const a = addBusinessDays(start, from), b = addBusinessDays(start, to);
    return from === to ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
  };

  const FREE = (window.THEME && window.THEME.free_shipping_threshold) || 15000;
  function rates(net, code = 'US') {
    const intl = code !== 'US';
    const list = intl
      ? [
        { id: 'intl-standard', title: 'International Standard', desc: 'Tracked, duties prepaid', price: net >= FREE ? 0 : 1500, from: 6, to: 10 },
        { id: 'intl-express', title: 'International Express', desc: 'DHL Express, duties prepaid', price: 3200, from: 3, to: 5 },
      ]
      : [
        { id: 'standard', title: 'Standard', desc: 'Tracked, carbon-neutral delivery', price: net >= FREE ? 0 : 900, from: 5, to: 7 },
        { id: 'express', title: 'Express', desc: 'Priority handling, signature-free', price: 1800, from: 2, to: 3 },
        { id: 'next-day', title: 'Next business day', desc: 'Order before 2 pm ET', price: 3200, from: 1, to: 1 },
      ];
    return list.map((r) => ({ ...r, eta: eta(r.from, r.to) }));
  }

  /* autocomplete-style suggestions (in Shopify this is the Places API behind the checkout) */
  const addresses = [
    { address1: '148 Mercer Street', city: 'New York', province: 'New York', zip: '10012', country: 'US' },
    { address1: '1420 Abbot Kinney Boulevard', city: 'Venice', province: 'California', zip: '90291', country: 'US' },
    { address1: '2201 Westlake Avenue', city: 'Seattle', province: 'Washington', zip: '98121', country: 'US' },
    { address1: '845 North Michigan Avenue', city: 'Chicago', province: 'Illinois', zip: '60611', country: 'US' },
    { address1: '310 South Congress Avenue', city: 'Austin', province: 'Texas', zip: '78704', country: 'US' },
    { address1: '72 Newbury Street', city: 'Boston', province: 'Massachusetts', zip: '02116', country: 'US' },
    { address1: '1600 Larimer Street', city: 'Denver', province: 'Colorado', zip: '80202', country: 'US' },
    { address1: '901 Lincoln Road', city: 'Miami Beach', province: 'Florida', zip: '33139', country: 'US' },
    { address1: '488 Hayes Street', city: 'San Francisco', province: 'California', zip: '94102', country: 'US' },
    { address1: '1100 Pennsylvania Avenue', city: 'Washington', province: 'District of Columbia', zip: '20004', country: 'US' },
    { address1: '220 King Street West', city: 'Toronto', province: 'Ontario', zip: 'M5H 1K4', country: 'CA' },
    { address1: '14 Neal Street', city: 'London', province: '', zip: 'WC2H 9PU', country: 'GB' },
    { address1: '18 Rue de Turenne', city: 'Paris', province: '', zip: '75004', country: 'FR' },
    { address1: '35 Torstraße', city: 'Berlin', province: '', zip: '10119', country: 'DE' },
    { address1: '112 Oxford Street', city: 'Paddington', province: 'New South Wales', zip: '2021', country: 'AU' },
  ];

  const GIFT_PRICE = 500;
  function totals(cart, { shipping = null, gift = false } = {}) {
    const subtotal = cart.subtotal, discount = cart.discountAmount;
    const ship = shipping === null ? cart.shipping : shipping;
    const giftAmt = gift && cart.count ? GIFT_PRICE : 0;
    const tax = Math.round((subtotal - discount + giftAmt) * 0.08);
    return { subtotal, discount, gift: giftAmt, shipping: ship, tax, total: subtotal - discount + giftAmt + (ship || 0) + tax, savings: cart.savings };
  }

  /* card helpers */
  const cardBrand = (n) => {
    const d = String(n).replace(/\D/g, '');
    if (/^4/.test(d)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
    if (/^3[47]/.test(d)) return 'amex';
    if (/^6(011|5)/.test(d)) return 'discover';
    return '';
  };
  const luhn = (n) => { const d = String(n).replace(/\D/g, ''); let s = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return d.length >= 13 && s % 10 === 0; };
  const formatCard = (n) => { const d = String(n).replace(/\D/g, '').slice(0, cardBrand(n) === 'amex' ? 15 : 16); return cardBrand(d) === 'amex' ? d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : d.replace(/(\d{4})(?=\d)/g, '$1 '); };

  window.ChioCheckout = { countries, country, rates, eta, addBusinessDays, fmt, addresses, totals, GIFT_PRICE, cardBrand, luhn, formatCard };

  window.ChioOrders = {
    all() { return load('orders', []); },
    get(id) { return this.all().find((o) => o.id === id) || null; },
    last() { const id = load('last_order', null); return (id && this.get(id)) || this.all()[0] || null; },
    save(order) { const list = [order, ...this.all().filter((o) => o.id !== order.id)].slice(0, 20); save('orders', list); save('last_order', order.id); return order; },
  };

  document.addEventListener('alpine:init', () => {
    if (window.Alpine.store('chioGift')) return;
    const g = load('gift_wrap', { on: false, message: '' });
    window.Alpine.store('chioGift', {
      on: !!g.on, message: g.message || '', price: GIFT_PRICE,
      toggle(v = !this.on) { this.on = v; this.persist(); },
      persist() { save('gift_wrap', { on: this.on, message: this.message }); },
      reset() { this.on = false; this.message = ''; this.persist(); },
    });
  });
})();
