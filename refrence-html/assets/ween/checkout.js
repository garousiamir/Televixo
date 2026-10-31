/*
 * Ween cart / checkout / order helpers (-> would become cart attributes, shipping profiles and the order object).
 * Loaded by the sections main-cart, main-checkout, main-order-confirmation (plain <script src>, before Alpine starts).
 *
 *   WeenCheckout.extras            { discreet, giftWrap, giftMessage }  persisted as ween:cart_extras (cart attributes)
 *   WeenCheckout.rates(country, subtotalAfterDiscount)  -> shipping methods [{ id, title, note, price, min, max }]
 *   WeenCheckout.totals(cart, shippingPrice)            -> { subtotal, discount, giftWrap, shipping, tax, total }
 *   WeenCheckout.orders / saveOrder(order) / findOrder(number)   ween:orders (newest first), ween:last_order
 *   WeenCheckout.cardBrand(number), window(min, max)
 */
(function () {
  const KEY = (k) => `ween:${k}`;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* private mode */ } };

  const GIFT_WRAP = 600; // cents

  const COUNTRIES = [
    { code: 'US', name: 'United States', zip: 'ZIP code', region: 'State', regions: ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Washington', 'Massachusetts', 'Georgia', 'Colorado', 'Oregon'], zone: 'domestic' },
    { code: 'CA', name: 'Canada', zip: 'Postal code', region: 'Province', regions: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Nova Scotia'], zone: 'na' },
    { code: 'GB', name: 'United Kingdom', zip: 'Postcode', region: 'County', regions: [], zone: 'intl' },
    { code: 'FR', name: 'France', zip: 'Postal code', region: 'Region', regions: [], zone: 'intl' },
    { code: 'DE', name: 'Germany', zip: 'Postal code', region: 'State', regions: [], zone: 'intl' },
    { code: 'IT', name: 'Italy', zip: 'Postal code', region: 'Province', regions: [], zone: 'intl' },
    { code: 'AU', name: 'Australia', zip: 'Postcode', region: 'State', regions: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania'], zone: 'intl' },
    { code: 'AE', name: 'United Arab Emirates', zip: 'Postal code', region: 'Emirate', regions: [], zone: 'intl' },
  ];

  // autocomplete-style suggestions (a real theme would call Google Places / Shopify address autocomplete)
  const ADDRESSES = [
    { address1: '214 Mercer Street', city: 'New York', region: 'New York', zip: '10012', country: 'US' },
    { address1: '88 Spring Street', city: 'New York', region: 'New York', zip: '10012', country: 'US' },
    { address1: '1450 Market Street', city: 'San Francisco', region: 'California', zip: '94102', country: 'US' },
    { address1: '725 Melrose Place', city: 'Los Angeles', region: 'California', zip: '90069', country: 'US' },
    { address1: '901 Ocean Drive', city: 'Miami Beach', region: 'Florida', zip: '33139', country: 'US' },
    { address1: '320 West Huron Street', city: 'Chicago', region: 'Illinois', zip: '60654', country: 'US' },
    { address1: '1201 Second Avenue', city: 'Seattle', region: 'Washington', zip: '98101', country: 'US' },
    { address1: '55 Newbury Street', city: 'Boston', region: 'Massachusetts', zip: '02116', country: 'US' },
    { address1: '410 Queen Street West', city: 'Toronto', region: 'Ontario', zip: 'M5V 2A5', country: 'CA' },
    { address1: '22 Marylebone High Street', city: 'London', region: 'Greater London', zip: 'W1U 4PE', country: 'GB' },
    { address1: '18 Rue du Faubourg Saint-Honoré', city: 'Paris', region: 'Île-de-France', zip: '75008', country: 'FR' },
    { address1: '64 Oxford Street', city: 'Sydney', region: 'New South Wales', zip: '2010', country: 'AU' },
  ];

  const addDays = (d, n) => { const x = new Date(d); let left = n; while (left > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) left--; } return x; };
  const fmt = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const windowText = (min, max, from = new Date()) => (min === max ? fmt(addDays(from, min)) : `${fmt(addDays(from, min))} – ${fmt(addDays(from, max))}`);

  function rates(countryCode = 'US', net = 0) {
    const c = COUNTRIES.find((x) => x.code === countryCode) || COUNTRIES[0];
    const free = net >= ((window.THEME && window.THEME.free_shipping_threshold) || 15000);
    if (c.zone === 'domestic') return [
      { id: 'standard', title: 'Standard', note: 'Discreet plain box · tracked', price: free ? 0 : 900, min: 4, max: 6 },
      { id: 'express', title: 'Express', note: 'Priority courier · tracked', price: 1800, min: 2, max: 3 },
      { id: 'next', title: 'Next business day', note: 'Order before 2 PM ET', price: 2800, min: 1, max: 1 },
    ];
    if (c.zone === 'na') return [
      { id: 'standard', title: 'Standard', note: 'Duties included · tracked', price: free ? 0 : 1400, min: 6, max: 9 },
      { id: 'express', title: 'Express', note: 'DHL Express · duties included', price: 2900, min: 3, max: 4 },
    ];
    return [
      { id: 'standard', title: 'International standard', note: 'Duties included · tracked', price: free ? 1200 : 2200, min: 8, max: 12 },
      { id: 'express', title: 'International express', note: 'DHL Express · duties included', price: 4200, min: 3, max: 5 },
    ];
  }

  function totals(cart, shippingPrice = null) {
    const ex = window.WeenCheckout.extras;
    const subtotal = cart.subtotal;
    const discount = cart.discountAmount || 0;
    const giftWrap = ex.giftWrap && cart.count ? GIFT_WRAP : 0;
    const shipping = shippingPrice == null ? cart.shipping : shippingPrice;
    const tax = Math.round((subtotal - discount + giftWrap) * 0.08);
    return { subtotal, discount, giftWrap, shipping, tax, total: subtotal - discount + giftWrap + shipping + tax };
  }

  function cardBrand(num) {
    const n = String(num || '').replace(/\D/g, '');
    if (/^4/.test(n)) return { id: 'visa', name: 'Visa', cvc: 3, gaps: [4, 8, 12], len: 16 };
    if (/^(5[1-5]|2[2-7])/.test(n)) return { id: 'mastercard', name: 'Mastercard', cvc: 3, gaps: [4, 8, 12], len: 16 };
    if (/^3[47]/.test(n)) return { id: 'amex', name: 'American Express', cvc: 4, gaps: [4, 10], len: 15 };
    if (/^6(011|5)/.test(n)) return { id: 'discover', name: 'Discover', cvc: 3, gaps: [4, 8, 12], len: 16 };
    return null;
  }
  function luhn(num) {
    const d = String(num).replace(/\D/g, ''); let s = 0; let alt = false;
    for (let i = d.length - 1; i >= 0; i--) { let x = +d[i]; if (alt) { x *= 2; if (x > 9) x -= 9; } s += x; alt = !alt; }
    return d.length >= 13 && s % 10 === 0;
  }

  // Extras are an Alpine-reactive object once Alpine starts (see alpine:init below).
  const extras = Object.assign({ discreet: true, giftWrap: false, giftMessage: '', giftFrom: '' }, load('cart_extras', {}));

  window.WeenCheckout = {
    GIFT_WRAP, COUNTRIES, ADDRESSES, rates, totals, cardBrand, luhn,
    window: windowText, addDays,
    extras,
    saveExtras() { save('cart_extras', { ...this.extras }); },
    resetExtras() { Object.assign(this.extras, { giftWrap: false, giftMessage: '', giftFrom: '', ship: null, shipCountry: null, shipZip: null }); this.saveExtras(); },
    get orders() { return load('orders', []); },
    saveOrder(order) { save('orders', [order, ...load('orders', []).filter((o) => o.number !== order.number)].slice(0, 20)); save('last_order', order.number); },
    findOrder(number) { const all = load('orders', []); return all.find((o) => o.number === (number || load('last_order', null))) || null; },
    nextNumber() { const n = load('order_seq', 10480) + Math.floor(Math.random() * 7) + 1; save('order_seq', n); return `WN-${n}`; },
  };

  document.addEventListener('alpine:init', () => {
    window.WeenCheckout.extras = window.Alpine.reactive(window.WeenCheckout.extras);
  });
})();
