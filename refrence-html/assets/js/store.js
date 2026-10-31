/*
 * Shared storefront state for every theme variation (Chio / Ween / Volin).
 * Load AFTER the theme's catalog (assets/<theme>/catalog.js) and BEFORE Alpine:
 *
 *   <script src="assets/<theme>/catalog.js"></script>
 *   <script src="assets/js/store.js"></script>
 *   <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
 *
 * Data shapes deliberately follow Shopify's Ajax API so the move to a real theme is a swap of
 * the persistence layer only (localStorage -> /cart/add.js, /cart/change.js, /search/suggest.json):
 *   product: { id, handle, title, vendor, type, tags[], price, compare_at_price, available,
 *              rating, rating_count, featured_image, images[], options[{name, values[]}],
 *              variants[{ id, title, options[], price, compare_at_price, available }],
 *              collections[], description, url }
 *   money is in cents. Catalog: window.THEME = { key, currency, money_format, products[], collections[] }
 */
(function () {
  const T = window.THEME || { key: 'theme', currency: 'USD', products: [], collections: [] };
  const KEY = (k) => `${T.key}:${k}`;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(KEY(k))); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* private mode */ } };

  const money = (cents) => {
    const v = (Number(cents) || 0) / 100;
    return (T.money_format || '${{amount}}').replace('{{amount}}', v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  };
  const byHandle = (h) => T.products.find((p) => p.handle === h);
  const variantOf = (p, id) => (p && (p.variants.find((v) => v.id === id) || p.variants.find((v) => v.available) || p.variants[0])) || null;

  window.Theme = { money, byHandle, variantOf, products: T.products, collections: T.collections };

  document.addEventListener('alpine:init', () => {
    const Alpine = window.Alpine;

    Alpine.store('ui', {
      drawer: null,            // 'cart' | 'search' | 'menu' | 'filters' | 'quickview' | null
      quickview: null,         // product handle
      toasts: [],
      opener: null,            // element focused before an overlay opened; focus returns to it on close
      open(name) {
        if (!this.drawer) this.opener = document.activeElement;
        this.drawer = name; document.documentElement.classList.add('overflow-hidden');
      },
      close() {
        this.drawer = null; this.quickview = null; document.documentElement.classList.remove('overflow-hidden');
        const el = this.opener; this.opener = null;
        if (el && typeof el.focus === 'function' && document.contains(el)) requestAnimationFrame(() => el.focus());
      },
      toggle(name) { this.drawer === name ? this.close() : this.open(name); },
      quick(handle) { this.quickview = handle; this.open('quickview'); },
      toast(message, type = 'success') {
        const id = Date.now() + Math.random();
        this.toasts.push({ id, message, type });
        setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, 3200);
      },
    });

    Alpine.store('cart', {
      items: load('cart', []),   // [{ key, handle, variant_id, quantity }]
      note: load('cart_note', ''),
      discount: load('cart_discount', null), // { code, percent }
      freeShippingThreshold: T.free_shipping_threshold ?? 15000,
      get lines() {
        return this.items.map((i) => {
          const p = byHandle(i.handle); const v = variantOf(p, i.variant_id);
          if (!p || !v) return null;
          return { ...i, product: p, variant: v, title: p.title, image: p.featured_image, options: v.options,
            price: v.price, compare_at_price: v.compare_at_price, line_price: v.price * i.quantity, url: p.url };
        }).filter(Boolean);
      },
      get count() { return this.items.reduce((n, i) => n + i.quantity, 0); },
      get subtotal() { return this.lines.reduce((n, l) => n + l.line_price, 0); },
      get savings() { return this.lines.reduce((n, l) => n + Math.max(0, (l.compare_at_price || 0) - l.price) * l.quantity, 0); },
      get discountAmount() { return this.discount ? Math.round(this.subtotal * this.discount.percent / 100) : 0; },
      get shipping() { return this.subtotal - this.discountAmount >= this.freeShippingThreshold || !this.count ? 0 : 900; },
      get tax() { return Math.round((this.subtotal - this.discountAmount) * 0.08); },
      get total() { return this.subtotal - this.discountAmount + this.shipping + this.tax; },
      get freeShippingRemaining() { return Math.max(0, this.freeShippingThreshold - (this.subtotal - this.discountAmount)); },
      get freeShippingProgress() { return Math.min(100, Math.round(((this.subtotal - this.discountAmount) / this.freeShippingThreshold) * 100)); },
      persist() { save('cart', this.items); save('cart_note', this.note); save('cart_discount', this.discount); },
      add(handle, variantId = null, quantity = 1, { openDrawer = true } = {}) {
        const p = byHandle(handle); const v = variantOf(p, variantId);
        if (!p || !v) return;
        if (!v.available) { Alpine.store('ui').toast('This option is sold out', 'error'); return; }
        const key = `${handle}:${v.id}`;
        const line = this.items.find((i) => i.key === key);
        line ? (line.quantity += quantity) : this.items.push({ key, handle, variant_id: v.id, quantity });
        this.persist();
        if (Alpine.store('ui').drawer !== 'cart') Alpine.store('ui').toast(`${p.title} added to cart`);
        if (openDrawer) Alpine.store('ui').open('cart');
      },
      setQty(key, q) {
        const line = this.items.find((i) => i.key === key); if (!line) return;
        line.quantity = Math.max(0, Math.min(99, q));
        if (!line.quantity) this.items = this.items.filter((i) => i.key !== key);
        this.persist();
      },
      remove(key) { this.items = this.items.filter((i) => i.key !== key); this.persist(); },
      clear() { this.items = []; this.discount = null; this.persist(); },
      applyCode(code) {
        const c = String(code || '').trim().toUpperCase();
        const codes = T.discount_codes || { WELCOME10: 10, SAVE20: 20 };
        if (codes[c]) { this.discount = { code: c, percent: codes[c] }; this.persist(); Alpine.store('ui').toast(`Code ${c} applied`); return true; }
        Alpine.store('ui').toast('That code is not valid', 'error'); return false;
      },
      removeCode() { this.discount = null; this.persist(); },
    });

    Alpine.store('wishlist', {
      handles: load('wishlist', []),
      has(h) { return this.handles.includes(h); },
      toggle(h) {
        this.has(h) ? (this.handles = this.handles.filter((x) => x !== h)) : this.handles.push(h);
        save('wishlist', this.handles);
        Alpine.store('ui').toast(this.has(h) ? 'Saved to wishlist' : 'Removed from wishlist');
      },
      get products() { return this.handles.map(byHandle).filter(Boolean); },
      get count() { return this.handles.length; },
      clear() { this.handles = []; save('wishlist', this.handles); },
    });

    Alpine.store('recent', {
      handles: load('recent', []),
      push(h) { this.handles = [h, ...this.handles.filter((x) => x !== h)].slice(0, 12); save('recent', this.handles); },
      get products() { return this.handles.map(byHandle).filter(Boolean); },
    });

    Alpine.store('search', {
      query: '',
      history: load('search_history', []),
      get results() {
        const q = this.query.trim().toLowerCase();
        if (q.length < 2) return [];
        return T.products.filter((p) => [p.title, p.type, p.vendor, ...(p.tags || [])].join(' ').toLowerCase().includes(q)).slice(0, 8);
      },
      get collections() {
        const q = this.query.trim().toLowerCase();
        return q.length < 2 ? [] : (T.collections || []).filter((c) => c.title.toLowerCase().includes(q)).slice(0, 4);
      },
      remember(q = this.query) {
        q = q.trim(); if (!q) return;
        this.history = [q, ...this.history.filter((x) => x !== q)].slice(0, 6); save('search_history', this.history);
      },
      clearHistory() { this.history = []; save('search_history', this.history); },
      go(q = this.query) { this.remember(q); location.href = `${T.key}-search.html?q=${encodeURIComponent(q)}`; },
    });
  });
})();
