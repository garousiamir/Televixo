/*
 * Volin cart / checkout helpers (static stand-in for Shopify cart attributes, shipping rates and the order object).
 * Loaded by sections main-cart, main-checkout, main-order-confirmation (a plain <script> inside the section, before Alpine).
 *
 * localStorage keys (prefixed "volin:"):
 *   gift_wrap   { on: bool, message: '' }                  -> cart attribute "Gift wrap"
 *   ship_rate   { country: 'US', zip: '', id: 'standard' }  -> shipping estimator choice, preselected at checkout
 *   orders      [order, …] newest first                     -> customer.orders (account page reads this too)
 *   last_order  'VL-10482'                                  -> order number of the most recent checkout
 *
 * order = { number: 'VL-10482', name: '#VL-10482', created_at: ISO, status: 'confirmed', email, phone,
 *           shipping_address: { first_name, last_name, address1, address2, city, province, zip, country, country_code, phone },
 *           billing_address: { …same shape }, shipping_line: { id, title, price, eta, eta_from, eta_to },
 *           payment: { method: 'card'|'paypal'|'klarna'|'shop_pay'|'apple_pay'|'google_pay', label, brand, last4 },
 *           lines: [{ key, handle, variant_id, title, variant_title, options[], image, url, quantity, price, compare_at_price, line_price }],
 *           item_count, subtotal, discount: { code, percent, amount } | null, gift_wrap: { price, message } | null,
 *           shipping, tax, total, note, newsletter }   (money in cents)
 */
(function () {
  if (window.VolinCheckout) return;
  const KEY = (k) => `volin:${k}`;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* private mode */ } };

  const GIFT_WRAP_PRICE = 500;
  const TAX_RATE = 0.08;

  const countries = [
    { code: 'US', name: 'United States', region: 'State', zip: 'ZIP code', zipRe: /^\d{5}(-\d{4})?$/, zipHint: '5 digits, e.g. 10013' },
    { code: 'CA', name: 'Canada', region: 'Province', zip: 'Postal code', zipRe: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, zipHint: 'e.g. M5V 2T6' },
    { code: 'GB', name: 'United Kingdom', region: 'County', zip: 'Postcode', zipRe: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, zipHint: 'e.g. SW1A 1AA' },
    { code: 'DE', name: 'Germany', region: 'State', zip: 'Postal code', zipRe: /^\d{5}$/, zipHint: '5 digits, e.g. 10115' },
    { code: 'FR', name: 'France', region: 'Region', zip: 'Postal code', zipRe: /^\d{5}$/, zipHint: '5 digits, e.g. 75003' },
    { code: 'NL', name: 'Netherlands', region: 'Province', zip: 'Postal code', zipRe: /^\d{4} ?[A-Za-z]{2}$/, zipHint: 'e.g. 1012 AB' },
    { code: 'AU', name: 'Australia', region: 'State', zip: 'Postcode', zipRe: /^\d{4}$/, zipHint: '4 digits, e.g. 2000' },
  ];
  const regions = {
    US: ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
    CA: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'],
    AU: ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
  };
  const country = (code) => countries.find((c) => c.code === code) || countries[0];

  // "autocomplete" suggestions (stand-in for a places API)
  const addresses = [
    { address1: '350 Canal Street', city: 'New York', province: 'New York', zip: '10013', country_code: 'US' },
    { address1: '35 Crosby Street', city: 'New York', province: 'New York', zip: '10013', country_code: 'US' },
    { address1: '120 Wythe Avenue', city: 'Brooklyn', province: 'New York', zip: '11249', country_code: 'US' },
    { address1: '8500 Melrose Avenue', city: 'West Hollywood', province: 'California', zip: '90069', country_code: 'US' },
    { address1: '1455 Market Street', city: 'San Francisco', province: 'California', zip: '94103', country_code: 'US' },
    { address1: '1600 Pennsylvania Avenue NW', city: 'Washington', province: 'District of Columbia', zip: '20500', country_code: 'US' },
    { address1: '2100 N Halsted Street', city: 'Chicago', province: 'Illinois', zip: '60614', country_code: 'US' },
    { address1: '1201 S Congress Avenue', city: 'Austin', province: 'Texas', zip: '78704', country_code: 'US' },
    { address1: '301 Front Street West', city: 'Toronto', province: 'Ontario', zip: 'M5V 2T6', country_code: 'CA' },
    { address1: '221 Shoreditch High Street', city: 'London', province: 'Greater London', zip: 'E1 6PJ', country_code: 'GB' },
    { address1: 'Torstraße 109', city: 'Berlin', province: 'Berlin', zip: '10119', country_code: 'DE' },
    { address1: '12 Rue de Turenne', city: 'Paris', province: 'Île-de-France', zip: '75004', country_code: 'FR' },
    { address1: 'Prinsengracht 263', city: 'Amsterdam', province: 'North Holland', zip: '1016 GV', country_code: 'NL' },
    { address1: '45 Oxford Street', city: 'Sydney', province: 'New South Wales', zip: '2010', country_code: 'AU' },
  ];
  const suggest = (q, code) => {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const words = q.split(/\s+/);
    return addresses.filter((a) => (!code || a.country_code === code) && words.every((w) => `${a.address1} ${a.city} ${a.zip}`.toLowerCase().includes(w))).slice(0, 5);
  };

  // business-day delivery window
  const addBusinessDays = (date, n) => { const d = new Date(date); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) k++; } return d; };
  const fmtDate = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(d).toLocaleDateString('en-US', opts);
  const windowLabel = (from, to) => (from === to ? fmtDate(addBusinessDays(new Date(), from)) : `${fmtDate(addBusinessDays(new Date(), from))} – ${fmtDate(addBusinessDays(new Date(), to))}`);

  // shipping rates by destination; `net` = subtotal after discount (cents)
  const rates = (code, net) => {
    const domestic = code === 'US';
    const list = domestic
      ? [
        { id: 'standard', title: 'Standard', carrier: 'USPS Ground Advantage', from: 4, to: 6, price: net >= 15000 ? 0 : 900 },
        { id: 'express', title: 'Express', carrier: 'UPS 2nd Day Air', from: 2, to: 3, price: 1800 },
        { id: 'overnight', title: 'Next business day', carrier: 'FedEx Priority Overnight', from: 1, to: 1, price: 2900 },
      ]
      : [
        { id: 'standard', title: 'International standard', carrier: 'DHL eCommerce', from: 7, to: 12, price: net >= 25000 ? 0 : 1900 },
        { id: 'express', title: 'International express', carrier: 'DHL Express', from: 3, to: 5, price: 3900 },
      ];
    return list.map((r) => ({ ...r, eta: windowLabel(r.from, r.to), eta_from: addBusinessDays(new Date(), r.from).toISOString(), eta_to: addBusinessDays(new Date(), r.to).toISOString() }));
  };

  // cards
  const cardBrand = (num) => {
    const n = String(num || '').replace(/\D/g, '');
    if (/^4/.test(n)) return 'visa';
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard';
    if (/^3[47]/.test(n)) return 'amex';
    if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
    return '';
  };
  const brandName = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' };
  const formatCard = (num) => {
    const n = String(num || '').replace(/\D/g, '');
    if (cardBrand(n) === 'amex') { const d = n.slice(0, 15); return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' '); }
    return n.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  };
  const luhn = (num) => {
    const n = String(num || '').replace(/\D/g, ''); let sum = 0;
    for (let i = 0; i < n.length; i++) { let d = +n[n.length - 1 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return n.length >= 13 && sum % 10 === 0;
  };
  const formatExpiry = (v) => {
    let n = String(v || '').replace(/\D/g, '').slice(0, 4);
    if (n.length === 1 && +n > 1) n = `0${n}`;
    return n.length > 2 ? `${n.slice(0, 2)} / ${n.slice(2)}` : n;
  };
  const expiryValid = (v) => {
    const m = String(v || '').match(/^(\d{2}) \/ (\d{2})$/); if (!m) return false;
    const mo = +m[1], yr = 2000 + +m[2]; if (mo < 1 || mo > 12) return false;
    const now = new Date(); return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1);
  };

  // orders
  const orders = () => load('orders', []);
  const findOrder = (num) => orders().find((o) => o.number === num) || null;
  const lastOrder = () => findOrder(load('last_order', '')) || orders()[0] || null;
  const nextNumber = () => `VL-${10480 + orders().length + 1 + Math.floor(Math.random() * 9) * 10}`;
  const saveOrder = (o) => { save('orders', [o, ...orders().filter((x) => x.number !== o.number)].slice(0, 30)); save('last_order', o.number); };

  window.VolinCheckout = {
    load, save, GIFT_WRAP_PRICE, TAX_RATE, countries, country, regions, suggest, rates, addBusinessDays, fmtDate,
    cardBrand, brandName, formatCard, luhn, formatExpiry, expiryValid, orders, findOrder, lastOrder, nextNumber, saveOrder,
    emailValid: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()),
    phoneValid: (p) => !p || String(p).replace(/\D/g, '').length >= 7,
  };
})();
