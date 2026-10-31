/*
 * Volin theme helpers. Load AFTER assets/js/store.js and BEFORE Alpine.
 *   window.Volin          formatting + slider helpers used by sections/snippets
 *   $store.countdown      shared "offer ended in" timer (offers + amazing-offer sections)
 *   Alpine.data('volinCard', product)          state for snippets/product-card.html
 *   Alpine.data('volinProductForm', handle)    option pickers + qty + add to cart (quick view, product page)
 *   Overlay focus management: every overlay root carries data-overlay="<$store.ui.drawer name>".
 */
(function () {
  const IMG = 'assets/images/volin/';
  const img = (name, ext = 'jpg') => `${IMG}${name}.${ext}`;
  const ico = (d, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  // "23" / "23.50" – Volin prints the number in Druk and the $ as an svg glyph (assets/images/volin/dollar.svg)
  const amount = (cents) => { const v = (Number(cents) || 0) / 100; return v % 1 === 0 ? String(v) : v.toFixed(2); };
  const off = (p) => (p && p.compare_at_price > p.price ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100) : 0);
  const option = (p, name) => ((p && p.options) || []).find((o) => o.name === name);
  const sizes = (p) => (option(p, 'Size') || { values: [] }).values;
  const swatches = (p) => { const o = option(p, 'Color'); return o ? o.values.map((v) => [v, (o.swatches || {})[v] || '#cccccc']) : []; };
  // cards have room for 4 size chips: XS S … XL XXL (as in the Figma card)
  const cardSizes = (p) => { const s = sizes(p); return s.length > 4 ? [s[0], s[1], s[s.length - 2], s[s.length - 1]] : s; };
  const findVariant = (p, sel) => p && (p.variants.find((v) => p.options.every((o, i) => sel[o.name] == null || v.options[i] === sel[o.name])) || null);
  const params = new URLSearchParams(location.search);

  // dash pagination with a fixed number of dashes mapped onto the slider's snap points (Figma shows 4)
  const dashPager = (sw, el, n) => {
    if (!sw || !el) return;
    const render = () => {
      const snaps = Math.max(1, sw.snapGrid.length);
      const act = snaps <= 1 ? 0 : Math.round(sw.snapIndex / (snaps - 1) * (n - 1));
      el.innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" aria-label="Go to slide group ${i + 1}" class="swiper-pagination-bullet${i === act ? ' swiper-pagination-bullet-active' : ''}"></button>`).join('');
      el.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => sw.slideTo(Math.round(i / (n - 1) * (snaps - 1)))));
    };
    ['snapIndexChange', 'slideChange', 'resize', 'breakpoint', 'update'].forEach((e) => sw.on(e, render));
    render();
  };

  const icons = {
    home: 'M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6',
    categories: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zM4 13a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6zM16 13a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-6z',
    bag: 'M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z',
    search: 'm21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
    heart: 'M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0z',
    tag: 'M7 7h.01M7 3h5a1.99 1.99 0 0 1 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A1.994 1.994 0 0 1 3 12V7a4 4 0 0 1 4-4z',
    eye: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    close: 'M6 18 18 6M6 6l12 12',
  };

  window.Volin = { img, ico, icons, amount, off, sizes, swatches, cardSizes, findVariant, dashPager, param: (k) => params.get(k) };

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  document.addEventListener('alpine:init', () => {
    const Alpine = window.Alpine;

    Alpine.store('countdown', {
      d: '01', h: '14', m: '23', short: '2D : 28 H : 32 M',
      deadline: Date.now() + ((1 * 24 + 14) * 60 + 23) * 60 * 1000 + 59000,
      init() { this.tick(); setInterval(() => this.tick(), 30000); },
      tick() {
        const diff = Math.max(0, this.deadline - Date.now());
        const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4);
        const pad = (n) => String(n).padStart(2, '0');
        Object.assign(this, { d: pad(d), h: pad(h), m: pad(m), short: `${d}D : ${h} H : ${m} M` });
      },
    });

    /* product card – `p` is the product (may carry display overrides from a section block; handle is what's sold) */
    Alpine.data('volinCard', (p) => ({
      handle: p.handle,
      size: cardSizes(p)[0] || null,
      get real() { return Theme.byHandle(this.handle) || p; },
      get variant() {
        const r = this.real; if (!r.variants) return null;
        return findVariant(r, { Size: this.size }) || r.variants[0];
      },
      get key() { return this.variant ? `${this.handle}:${this.variant.id}` : ''; },
      get qty() { const l = Alpine.store('cart').items.find((i) => i.key === this.key); return l ? l.quantity : 0; },
      add() { if (this.variant) Alpine.store('cart').add(this.handle, this.variant.id, 1); },
      inc() { this.qty ? Alpine.store('cart').setQty(this.key, this.qty + 1) : this.add(); },
      dec() { Alpine.store('cart').setQty(this.key, this.qty - 1); },
    }));

    /* option pickers + qty for quick view / product page. Call with a handle or a getter returning a handle. */
    Alpine.data('volinProductForm', (source) => ({
      selected: {}, qty: 1, image: 0,
      get handle() { return typeof source === 'function' ? source() : source; },
      get product() { return Theme.byHandle(this.handle); },
      get variant() { return this.product ? findVariant(this.product, this.selected) || this.product.variants[0] : null; },
      get price() { return this.variant ? this.variant.price : 0; },
      get compare() { return this.variant ? this.variant.compare_at_price : 0; },
      reset() {
        const p = this.product; this.qty = 1; this.image = 0; this.selected = {};
        if (!p) return;
        const v = p.variants.find((x) => x.available) || p.variants[0];
        p.options.forEach((o, i) => { this.selected[o.name] = v.options[i]; });
      },
      isAvailable(name, value) {
        const p = this.product; if (!p) return false;
        const sel = { ...this.selected, [name]: value };
        return p.variants.some((v) => v.available && p.options.every((o, i) => v.options[i] === sel[o.name]));
      },
      add() { if (this.variant) Alpine.store('cart').add(this.handle, this.variant.id, this.qty); },
      init() { this.reset(); this.$watch('handle', () => this.reset()); },
    }));

    /* ----- overlay focus management: focus first field on open, trap Tab, restore focus on close ----- */
    let opener = null; let prev = null;
    const root = () => { const d = Alpine.store('ui').drawer; return d ? document.querySelector(`[data-overlay="${d}"]`) : null; };
    Alpine.effect(() => {
      const d = Alpine.store('ui').drawer;
      if (d && !prev) opener = document.activeElement;
      prev = d;
      setTimeout(() => {
        if (d) {
          const r = root(); if (!r || r.contains(document.activeElement)) return;
          const t = r.querySelector('[autofocus]') || [...r.querySelectorAll(FOCUSABLE)].find(visible);
          t && t.focus({ preventScroll: true });
        } else if (opener) { opener.focus && opener.focus({ preventScroll: true }); opener = null; }
      }, 80);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const r = root(); if (!r) return;
      const f = [...r.querySelectorAll(FOCUSABLE)].filter(visible); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!r.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  });
})();
