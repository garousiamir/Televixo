/*
 * Volin storefront filtering (-> Shopify Storefront filtering: collection.filters / search.filters + facets.js).
 * Shared by sections/main-collection.html and sections/main-search.html. Load with a plain <script> BEFORE Alpine
 * runs (Alpine is deferred, so a script tag inside the section is early enough).
 *
 *   Alpine.data('volinCollection', () => VolinFacets.create({ scope() { return [...] }, ...extra }))
 *
 * State lives in the URL (shareable):  ?collection=&q=&sort=&min=&max=&size=M,L&color=Black&type=Hoodies
 *                                       &avail=1&sale=1&rating=4&view=3|4|list&cols=1|2&page=2
 */
(function () {
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'];
  const opt = (p, name) => ((p.options || []).find((o) => o.name === name) || { values: [] });
  const dollars = (c) => Math.round((c || 0) / 100);
  const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
  const onSale = (p) => p.compare_at_price && p.compare_at_price > p.price;
  const hasSizeAvail = (p, size) => p.variants.some((v) => v.available && v.options[0] === size);

  const SORTS = [
    ['featured', 'Featured'], ['best-selling', 'Best selling'], ['price-asc', 'Price, low to high'],
    ['price-desc', 'Price, high to low'], ['newest', 'Newest'], ['rating', 'Top rated'],
  ];

  /* Merge objects keeping getters intact (object spread would evaluate them). */
  const extend = (target, ...sources) => {
    sources.forEach((s) => s && Object.defineProperties(target, Object.getOwnPropertyDescriptors(s)));
    return target;
  };

  const emptyFilters = () => ({ avail: false, sale: false, min: null, max: null, sizes: [], colors: [], types: [], rating: 0 });

  function create(extra = {}) {
    const P = new URLSearchParams(location.search);
    const base = {
      // ---- section settings (-> {% schema %}) ----
      perPage: 12,
      paging: 'load_more',          // 'load_more' | 'pages'
      promoAfter: 6,                // inject the promo tile after N products (0 = off)
      sorts: SORTS,

      // ---- state ----
      f: emptyFilters(),
      sort: P.get('sort') || 'featured',
      view: ['3', '4', 'list'].includes(P.get('view')) ? P.get('view') : '3',
      cols: P.get('cols') === '1' ? 1 : 2,
      page: Math.max(1, parseInt(P.get('page'), 10) || 1),
      shown: 0,
      sidebar: true,
      loading: true,
      desktop: window.matchMedia('(min-width: 1024px)').matches,
      groups: { category: true, avail: true, price: true, size: true, color: true, type: true, rating: false, sale: true },
      pmin: 0, pmax: 0,             // slider positions (dollars), committed to f.min / f.max on release
      _t: null,

      /* override: the products this page browses before facets (collection products / search matches) */
      scope() { return Theme.products; },

      // ---- facet helpers ----
      get bounds() {
        const s = this.scope(); if (!s.length) return [0, 0];
        return [Math.floor(Math.min(...s.map((p) => p.price)) / 100), Math.ceil(Math.max(...s.map((p) => p.price)) / 100)];
      },
      match(p, skip) {
        const f = this.f;
        if (skip !== 'avail' && f.avail && !p.available) return false;
        if (skip !== 'sale' && f.sale && !onSale(p)) return false;
        if (skip !== 'price' && f.min != null && p.price < f.min * 100) return false;
        if (skip !== 'price' && f.max != null && p.price > f.max * 100) return false;
        if (skip !== 'size' && f.sizes.length && !f.sizes.some((s) => (f.avail ? hasSizeAvail(p, s) : opt(p, 'Size').values.includes(s)))) return false;
        if (skip !== 'color' && f.colors.length && !f.colors.some((c) => opt(p, 'Color').values.includes(c))) return false;
        if (skip !== 'type' && f.types.length && !f.types.includes(p.type)) return false;
        if (skip !== 'rating' && f.rating && Math.round(p.rating) < f.rating) return false;
        return true;
      },
      facet(skip) { return this.scope().filter((p) => this.match(p, skip)); },
      count(skip, test) { return this.facet(skip).filter(test).length; },
      get sizeValues() {
        const all = new Set(this.scope().flatMap((p) => opt(p, 'Size').values));
        return SIZE_ORDER.filter((s) => all.has(s)).concat([...all].filter((s) => !SIZE_ORDER.includes(s)));
      },
      get colorValues() {
        const m = new Map();
        this.scope().forEach((p) => { const o = opt(p, 'Color'); o.values.forEach((v) => m.has(v) || m.set(v, (o.swatches || {})[v] || '#ccc')); });
        return [...m.entries()];
      },
      get typeValues() { return [...new Set(this.scope().map((p) => p.type))].sort(); },
      sizeCount(s) { return this.count('size', (p) => (this.f.avail ? hasSizeAvail(p, s) : opt(p, 'Size').values.includes(s))); },
      colorCount(c) { return this.count('color', (p) => opt(p, 'Color').values.includes(c)); },
      typeCount(t) { return this.count('type', (p) => p.type === t); },
      ratingCount(r) { return this.count('rating', (p) => Math.round(p.rating) >= r); },
      get availCount() { return this.count('avail', (p) => p.available); },
      get saleCount() { return this.count('sale', onSale); },
      toggle(list, v) { const a = this.f[list]; const i = a.indexOf(v); i > -1 ? a.splice(i, 1) : a.push(v); },

      // ---- results ----
      relevance(p) { return 0; },
      get results() {
        const list = this.facet();
        const by = {
          'best-selling': (a, b) => b.rating_count - a.rating_count,
          'price-asc': (a, b) => a.price - b.price,
          'price-desc': (a, b) => b.price - a.price,
          newest: (a, b) => b.id - a.id,
          rating: (a, b) => b.rating - a.rating || b.rating_count - a.rating_count,
          relevance: (a, b) => this.relevance(b) - this.relevance(a),
        }[this.sort];
        return by ? [...list].sort(by) : list;
      },
      get pages() { return Math.max(1, Math.ceil(this.results.length / this.perPage)); },
      get visible() {
        const r = this.results;
        return this.paging === 'pages' ? r.slice((this.page - 1) * this.perPage, this.page * this.perPage) : r.slice(0, this.shown);
      },
      get tiles() {
        // products + the promo tile (an object with promo:true) – loop with x-for="product in tiles" :key="product.handle"
        const t = [...this.visible];
        if (this.promoAfter && t.length > this.promoAfter && !this.activeChips.length) t.splice(this.promoAfter, 0, { handle: '__promo', promo: true });
        return t;
      },
      get gridClass() {
        if (this.view === 'list' && this.desktop) return 'grid-cols-1 gap-6';
        const m = this.cols === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
        const d = this.sidebar ? (this.view === '4' ? 'lg:grid-cols-4' : 'lg:grid-cols-3') : (this.view === '4' ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-4');
        return `${m} ${d} gap-x-4 gap-y-10 lg:gap-x-6 lg:gap-y-12`;
      },
      get promoSpan() {
        if (this.view === 'list' && this.desktop) return 'col-span-1';
        return (this.cols === 1 ? 'col-span-1 sm:col-span-2' : 'col-span-2') + ' lg:col-span-2';
      },
      loadMore() { this.shown = Math.min(this.results.length, this.shown + this.perPage); this.syncUrl(); },
      goPage(n) {
        this.page = Math.min(this.pages, Math.max(1, n)); this.flash();
        this.$nextTick(() => { const el = this.$refs.results; el && window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' }); });
      },
      get pageList() {
        const n = this.pages, c = this.page, out = [];
        for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - c) <= 1) out.push(i); else if (out[out.length - 1] !== '…') out.push('…');
        return out;
      },

      // ---- active chips ----
      get activeChips() {
        const f = this.f, out = [];
        if (f.avail) out.push({ label: 'In stock', rm: () => { f.avail = false; } });
        if (f.sale) out.push({ label: 'On sale', rm: () => { f.sale = false; } });
        if (f.min != null || f.max != null) out.push({ label: `$${f.min ?? this.bounds[0]} – $${f.max ?? this.bounds[1]}`, rm: () => { f.min = null; f.max = null; this.resetSlider(); } });
        f.sizes.forEach((s) => out.push({ label: `Size: ${s}`, rm: () => this.toggle('sizes', s) }));
        f.colors.forEach((c) => out.push({ label: c, swatch: (this.colorValues.find((x) => x[0] === c) || [])[1], rm: () => this.toggle('colors', c) }));
        f.types.forEach((t) => out.push({ label: t, rm: () => this.toggle('types', t) }));
        if (f.rating) out.push({ label: `${f.rating}★ & up`, rm: () => { f.rating = 0; } });
        return out;
      },
      clearAll() { this.f = emptyFilters(); this.resetSlider(); },

      // ---- price slider ----
      resetSlider() { const [a, b] = this.bounds; this.pmin = this.f.min ?? a; this.pmax = this.f.max ?? b; },
      slide(which) {
        const gap = 1;
        if (which === 'min' && this.pmin > this.pmax - gap) this.pmin = this.pmax - gap;
        if (which === 'max' && this.pmax < this.pmin + gap) this.pmax = this.pmin + gap;
      },
      commitPrice() {
        const [a, b] = this.bounds;
        let lo = Math.max(a, Math.min(Number(this.pmin) || a, b)), hi = Math.min(b, Math.max(Number(this.pmax) || b, a));
        if (lo > hi) [lo, hi] = [hi, lo];
        this.pmin = lo; this.pmax = hi;
        this.f.min = lo > a ? lo : null; this.f.max = hi < b ? hi : null;
      },
      pct(v) { const [a, b] = this.bounds; return b > a ? ((v - a) / (b - a)) * 100 : 0; },

      // ---- skeleton flash when results change ----
      flash() {
        this.loading = true; clearTimeout(this._t);
        this._t = setTimeout(() => { this.loading = false; }, 380);
      },
      onChange() { this.page = 1; this.shown = this.perPage; this.flash(); this.syncUrl(); },

      // ---- URL <-> state ----
      readUrl() {
        const Q = new URLSearchParams(location.search), f = this.f;
        f.avail = Q.get('avail') === '1'; f.sale = Q.get('sale') === '1';
        f.min = Q.get('min') ? Number(Q.get('min')) : null; f.max = Q.get('max') ? Number(Q.get('max')) : null;
        f.sizes = csv(Q.get('size')); f.colors = csv(Q.get('color')); f.types = csv(Q.get('type'));
        f.rating = Number(Q.get('rating')) || 0;
      },
      urlExtra(Q) { /* sections add their own keys (collection / q / tab) */ },
      syncUrl() {
        const f = this.f, Q = new URLSearchParams();
        this.urlExtra(Q);
        if (this.sort !== this.defaultSort) Q.set('sort', this.sort);
        if (f.avail) Q.set('avail', '1');
        if (f.sale) Q.set('sale', '1');
        if (f.min != null) Q.set('min', f.min);
        if (f.max != null) Q.set('max', f.max);
        if (f.sizes.length) Q.set('size', f.sizes.join(','));
        if (f.colors.length) Q.set('color', f.colors.join(','));
        if (f.types.length) Q.set('type', f.types.join(','));
        if (f.rating) Q.set('rating', f.rating);
        if (this.view !== '3') Q.set('view', this.view);
        if (this.cols !== 2) Q.set('cols', this.cols);
        if (this.paging === 'pages' && this.page > 1) Q.set('page', this.page);
        const s = Q.toString().replace(/%2C/g, ',');
        history.replaceState(null, '', location.pathname + (s ? `?${s}` : '') + location.hash);
      },
      defaultSort: 'featured',

      openFilters() { Alpine.store('ui').open('filters'); },
      get filtersOpen() { return Alpine.store('ui').drawer === 'filters'; },

      init() {
        this.readUrl();
        this.setup && this.setup();
        this.resetSlider();
        this.shown = this.paging === 'pages' ? this.perPage : Math.max(this.perPage, this.page * this.perPage);
        const mq = window.matchMedia('(min-width: 1024px)');
        mq.addEventListener('change', (e) => { this.desktop = e.matches; if (e.matches && this.filtersOpen) Alpine.store('ui').close(); });
        this.$watch('f', () => this.onChange());
        this.$watch('sort', () => this.onChange());
        this.$watch('view', () => { this.flash(); this.syncUrl(); });
        this.$watch('cols', () => this.syncUrl());
        this.$watch('page', () => this.syncUrl());
        setTimeout(() => { this.loading = false; }, 450);   // first paint: skeleton while the "collection loads"
        this.ready && this.ready();
      },
    };
    return extend(base, extra);
  }

  /* wrap occurrences of `terms` inside the text of `els` with <mark> (search highlight) */
  function highlight(els, terms) {
    const words = (terms || []).filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    els.forEach((el) => {
      el.querySelectorAll('mark[data-hl]').forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
      el.normalize();
      if (!words.length) return;
      const re = new RegExp(`(${words.join('|')})`, 'gi');
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach((n) => {
        if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        n.nodeValue.split(re).forEach((part, i) => {
          if (!part) return;
          if (i % 2) { const m = document.createElement('mark'); m.dataset.hl = ''; m.className = 'vl-hl'; m.textContent = part; frag.appendChild(m); }
          else frag.appendChild(document.createTextNode(part));
        });
        n.replaceWith(frag);
      });
    });
  }

  /* tiny Levenshtein for "Did you mean" */
  function distance(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  window.VolinFacets = { create, extend, highlight, distance, SORTS, dollars };
})();
