/*
 * Ween theme runtime (-> assets/ween-theme.js). Load after catalog.js + store.js, before Alpine.
 *   - window.Ween: small helpers shared by sections/snippets (image paths, Figma crop vars, icons)
 *   - Alpine.data('weenTheme'): the <body> component (breakpoint, header/dock state, language)
 * Overlays (cart, search, menu, quick view) use $store.ui from assets/js/store.js.
 */
(function () {
  const img = (name, ext = 'jpg') => `assets/images/ween/${name}.${ext}`;
  // Figma crop helper: { x, y, w, h, dx, … } -> "--x:…%;--y:…%" (see .pos/.crop in theme-styles)
  const v = (o) => Object.entries(o).map(([k, val]) => `--${k}:${val}%`).join(';');

  const icons = {
    gmail: '<svg viewBox="0 0 20 20" fill="#9F9F9F"><path d="M14.23 5.47v9.07a1.63 1.63 0 0 0 3.26 0V5.47a1.63 1.63 0 0 0-3.26 0ZM5.77 5.47v9.08a1.63 1.63 0 1 1-3.26 0V5.47a1.63 1.63 0 1 1 3.26 0Z"/><path d="m5.26 4.29 5.88 5.67a1.63 1.63 0 1 1-2.24 2.37L3.02 6.65a1.63 1.63 0 0 1 2.24-2.36Z"/><path d="m14.73 4.27-5.87 5.67a1.63 1.63 0 1 0 2.24 2.37l5.88-5.68a1.63 1.63 0 0 0-2.25-2.36Z"/></svg>',
    x: '<svg viewBox="0 0 20 20" fill="none"><path d="M8 4c-.15-.22-.4-.36-.67-.36H4.29c-.26 0-.41.3-.27.51l8.05 11.87c.15.23.4.36.67.36h3.04c.26 0 .41-.29.27-.5Z" fill="#9F9F9F"/><path d="M8.71 11.19 3.89 16.67M15.63 3.33 11.1 8.48" stroke="#9F9F9F" stroke-linecap="round"/></svg>',
    linkedin: '<svg viewBox="0 0 20 20" fill="#9F9F9F"><path d="M13.18 7.82c1.42-.19 2.75.37 3.42 1.7.47.93.48 1.93.48 2.94v4.23c0 .22-.17.4-.39.4h-2.11a.4.4 0 0 1-.4-.4v-4.29c0-.13-.02-.26-.03-.39-.28-1.89-2.92-1.9-3.13-.08-.03.2-.02.41-.02.62v4.14c0 .22-.18.4-.4.4H8.47a.4.4 0 0 1-.4-.4c.01-2.77.04-5.53.01-8.29a.4.4 0 0 1 .4-.4h2.13c.22 0 .4.17.4.39v.74c.5-.79 1.24-1.18 2.18-1.31ZM3.03 8.39c0-.22.18-.4.4-.4h2.15c.22 0 .4.18.4.4v8.3c0 .22-.18.4-.4.4H3.43a.4.4 0 0 1-.4-.4v-8.3ZM4.5 6.09a1.58 1.58 0 1 0 0-3.17 1.58 1.58 0 0 0 0 3.17Z"/></svg>',
    discord: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.88 14.1c-.18.27-.63.96-.85 1.2-.1.12-.3.25-.45.24-1.27-.16-2.47-.54-3.46-1.4-.4-.36-.66-.77-.62-1.37.16-2.06.63-4.05 1.4-5.98a3.01 3.01 0 0 1 1.83-1.77c.5-.2 1.04-.37 1.58-.46.94-.16.97-.21 1.2.6a12.8 12.8 0 0 1 2.99 0c.22-.82.25-.76 1.2-.6.53.09 1.08.25 1.57.46.86.3 1.48.9 1.83 1.77.77 1.93 1.24 3.92 1.4 5.98.04.6-.21 1-.62 1.37-.99.87-2.19 1.24-3.46 1.4-.14.02-.34-.11-.45-.23-.22-.24-.67-.93-.85-1.2" /><path d="M5.96 13.22c2.69 1.6 5.39 1.6 8.09 0H5.96Z" fill="#fff" opacity=".9"/><circle cx="7.63" cy="10" r="1.1" fill="#fff" opacity=".9"/><circle cx="12.37" cy="10" r="1.1" fill="#fff" opacity=".9"/></svg>',
  };

  window.Ween = {
    img,
    v,
    icons,
    socials: [
      { name: 'gmail', icon: icons.gmail, url: 'mailto:hello@ween.store' },
      { name: 'twitter', icon: icons.x, url: '#' },
      { name: 'linkden', icon: icons.linkedin, url: '#' },
      { name: 'discord', icon: icons.discord, url: '#' },
    ],
    // collections shown in the header "Categories" dropdown / mobile menu (first 6 = home categories)
    navCollections() { return (window.THEME.collections || []).filter((c) => !c.hidden_in_nav).slice(0, 6); },
    collectionUrl: (handle) => `ween-shop.html?collection=${encodeURIComponent(handle)}`,
    discountPercent: (p) => (p && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0),
    param: (k) => new URLSearchParams(location.search).get(k),
    // relative date: "6 Oct 2026"
    date: (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),

    /*
     * Swiper scoped to an Alpine section: expects x-ref="swiper" (or .<name>-swiper) plus optional
     * .<name>-prev / .<name>-next buttons (class "pg") and .<name>-pagination (class "dots") inside the section.
     *   init() { this.$nextTick(() => { this.sw = Ween.swiper(this, 'products', { slidesPerView: 2 }); }); }
     */
    swiper(ctx, name, opts = {}, { nav = true, pag = true, a11y = true } = {}) {
      const root = ctx.$el;
      const q = (s) => root.querySelector(s);
      const el = (ctx.$refs && ctx.$refs.swiper) || q(`.${name}-swiper`);
      const o = { ...opts };
      if (nav && q(`.${name}-next`)) o.navigation = { nextEl: q(`.${name}-next`), prevEl: q(`.${name}-prev`) };
      if (pag && q(`.${name}-pagination`)) o.pagination = { el: q(`.${name}-pagination`), clickable: true };
      if (a11y) o.a11y = { enabled: true };
      return new window.Swiper(el, o);
    },
  };

  document.addEventListener('alpine:init', () => {
    const mq = window.matchMedia('(min-width: 1024px)');

    // <body x-data="weenTheme('home')">  — template name comes from the page meta
    window.Alpine.data('weenTheme', (template = '') => ({
      template,
      isLg: mq.matches,
      showDock: false,
      lang: 'ENG',
      socials: window.Ween.socials,
      init() {
        mq.addEventListener('change', (e) => { this.isLg = e.matches; });
        // home: the dock fades in after the hero (Figma); every other page shows it right away
        const onScroll = () => { this.showDock = this.template !== 'home' || window.scrollY > 640; };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      },
    }));

    /*
     * Product card / quick view / PDP option state:  x-data="weenCard(product)"
     *   color, size        selected option values (defaults = first available variant)
     *   variant            matching variant (falls back to the first one)
     *   line               cart line for the selected variant (null when not in cart)
     *   liked, discount    wishlist state, % off compare-at price
     *   add(qty, openDrawer)
     */
    window.Alpine.data('weenCard', (product) => {
      const p = product || {};
      const ci = (p.options || []).findIndex((o) => o.name === 'Color');
      const si = (p.options || []).findIndex((o) => o.name === 'Size');
      const first = (p.variants || []).find((x) => x.available) || (p.variants || [])[0] || { options: [] };
      return {
        color: ci > -1 ? first.options[ci] : null,
        size: si > -1 ? first.options[si] : null,
        get colors() { return ci > -1 ? p.options[ci].values : []; },
        get sizes() { return si > -1 ? p.options[si].values : []; },
        swatch(c) { return (ci > -1 && p.options[ci].swatches && p.options[ci].swatches[c]) || '#dadada'; },
        find(c, s) { return p.variants.find((x) => (ci < 0 || x.options[ci] === c) && (si < 0 || x.options[si] === s)); },
        isAvailable(c, s) { const x = this.find(c, s); return !!(x && x.available); },
        get variant() { return this.find(this.color, this.size) || p.variants[0]; },
        get line() { const key = `${p.handle}:${this.variant.id}`; return this.$store.cart.items.find((i) => i.key === key) || null; },
        get liked() { return this.$store.wishlist.has(p.handle); },
        get discount() { const x = this.variant; return x && x.compare_at_price > x.price ? Math.round((1 - x.price / x.compare_at_price) * 100) : 0; },
        add(qty = 1, openDrawer = true) { this.$store.cart.add(p.handle, this.variant.id, qty, { openDrawer }); },
      };
    });
  });
})();
