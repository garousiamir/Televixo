/*
 * Ween storefront filtering (-> Shopify Storefront filtering: collection.filters / search.filters).
 * Shared by sections/main-collection.html and sections/main-search.html (+ snippets shop-filters / shop-toolbar /
 * shop-grid). Loaded with a plain <script> inside the section, i.e. before the deferred Alpine runs.
 *
 *   Alpine.data('weenMainCollection', () => WeenFacets.create({ scope() { return [...] }, ...extra }))
 *
 * State lives in the URL (shareable):
 *   ?collection=&q=&sort=&min=&max=&size=M,34B&color=Black&type=Bra&cat=lace-panty&avail=1&sale=1&rating=4
 *   &view=3|4|list&cols=1|2&page=2
 */
(function () {
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '32A', '32B', '34A', '34B', '34C', '36B', '36C', '36D', '38C', '38D'];
  const optIndex = (p, name) => (p.options || []).findIndex((o) => o.name === name);
  const opt = (p, name) => ((p.options || []).find((o) => o.name === name) || { values: [] });
  const csv = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
  const onSale = (p) => !!(p.compare_at_price && p.compare_at_price > p.price);
  const sizeAvailable = (p, size) => { const i = optIndex(p, 'Size'); return p.variants.some((v) => v.available && v.options[i] === size); };

  const SORTS = [
    ['featured', 'Featured'], ['best-selling', 'Best selling'], ['price-asc', 'Price: low to high'],
    ['price-desc', 'Price: high to low'], ['newest', 'Newest'], ['rating', 'Top rated'],
  ];

  /* merge objects keeping getters intact (spread would evaluate them) */
  const extend = (target, ...sources) => {
    sources.forEach((s) => s && Object.defineProperties(target, Object.getOwnPropertyDescriptors(s)));
    return target;
  };

  const emptyFilters = () => ({ avail: false, sale: false, min: null, max: null, sizes: [], colors: [], types: [], cats: [], rating: 0 });

  function create(extra = {}) {
    const P = new URLSearchParams(location.search);
    const mq = window.matchMedia('(min-width: 1024px)');
    const base = {
      // ---- section settings (-> {% schema %}) ----
      perPage: 12,
      paging: 'load_more',         // 'load_more' | 'pages'
      promo: true,                 // inject the promo tile after two full rows
      sorts: SORTS,
      defaultSort: 'featured',
      categoryMode: 'nav',         // 'nav' = categories group switches the collection (shop) | 'facet' = multi-select filter (search)

      // ---- state ----
      f: emptyFilters(),
      sort: P.get('sort') || 'featured',
      view: ['3', '4', 'list'].includes(P.get('view')) ? P.get('view') : '3',
      cols: P.get('cols') === '1' ? 1 : 2,
      page: Math.max(1, parseInt(P.get('page'), 10) || 1),
      shown: 0,
      sidebar: P.get('view') !== '4',
      loading: true,
      desktop: mq.matches,
      vw: window.innerWidth,
      groups: { category: true, avail: true, price: true, size: true, color: true, type: false, rating: false, sale: true },
      pmin: 0, pmax: 0,           // slider positions (dollars), committed to f.min / f.max on release
      _t: null,

      /* override: the products this page browses before facets (collection products / search matches) */
      scope() { return Theme.products; },

      // ---- facet values + live counts (each facet counts against all *other* active facets) ----
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
        if (skip !== 'size' && f.sizes.length && !f.sizes.some((s) => (f.avail ? sizeAvailable(p, s) : opt(p, 'Size').values.includes(s)))) return false;
        if (skip !== 'color' && f.colors.length && !f.colors.some((c) => opt(p, 'Color').values.includes(c))) return false;
        if (skip !== 'type' && f.types.length && !f.types.includes(p.type)) return false;
        if (skip !== 'cat' && f.cats.length && !f.cats.some((c) => p.collections.includes(c))) return false;
        if (skip !== 'rating' && f.rating && p.rating < f.rating) return false;
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
        this.scope().forEach((p) => { const o = opt(p, 'Color'); o.values.forEach((v) => m.has(v) || m.set(v, (o.swatches || {})[v] || '#dadada')); });
        return [...m.entries()];
      },
      get typeValues() { return [...new Set(this.scope().map((p) => p.type))].sort(); },
      get catValues() { return Theme.collections.filter((c) => !c.hidden_in_nav && this.scope().some((p) => p.collections.includes(c.handle))); },
      sizeCount(s) { return this.count('size', (p) => (this.f.avail ? sizeAvailable(p, s) : opt(p, 'Size').values.includes(s))); },
      colorCount(c) { return this.count('color', (p) => opt(p, 'Color').values.includes(c)); },
      typeCount(t) { return this.count('type', (p) => p.type === t); },
      catCount(h) { return this.count('cat', (p) => p.collections.includes(h)); },
      ratingCount(r) { return this.count('rating', (p) => p.rating >= r); },
      get availCount() { return this.count('avail', (p) => p.available); },
      get saleCount() { return this.count('sale', onSale); },
      toggle(list, v) { const a = this.f[list]; const i = a.indexOf(v); i > -1 ? a.splice(i, 1) : a.push(v); },

      // ---- results ----
      relevance() { return 0; },
      get results() {
        const list = this.facet();
        const by = {
          'best-selling': (a, b) => b.rating_count - a.rating_count,
          'price-asc': (a, b) => a.price - b.price,
          'price-desc': (a, b) => b.price - a.price,
          newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
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
      /* grid columns currently on screen (drives where the promo tile lands: after two full rows) */
      get gridCols() {
        if (this.desktop) { if (this.view === 'list') return 1; const xl = this.vw >= 1280; return this.view === '4' ? (xl ? 4 : 3) : (this.sidebar ? (xl ? 3 : 2) : 3); }
        return this.vw >= 640 ? (this.cols === 1 ? 2 : 3) : this.cols;
      },
      get tiles() {
        // products + the promo tile ({ promo: true }) — x-for="product in tiles" :key="product.handle"
        const t = [...this.visible];
        const after = this.view === 'list' && this.desktop ? 4 : this.gridCols * 2;
        if (this.promo && this.page === 1 && t.length > after) t.splice(after, 0, { handle: '__promo', promo: true });
        return t;
      },
      get gridClass() {
        if (this.view === 'list' && this.desktop) return 'grid-cols-1 gap-4';
        const m = this.cols === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
        // below 1280px the sidebar leaves too little room for 3 cards (and 4 without it)
        const d = this.view === '4' ? 'lg:grid-cols-3 xl:grid-cols-4' : this.sidebar ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3';
        return `${m} ${d} gap-4 lg:gap-6`;
      },
      setView(v) {
        this.view = v;
        if (v === '4') this.sidebar = false;           // 4 columns = the home grid width (288px cards), no sidebar
        else if (v === '3' && !this.sidebar) this.sidebar = true;
      },
      toggleSidebar() {
        if (!this.desktop) return this.openFilters();
        this.sidebar = !this.sidebar;
        if (this.sidebar && this.view === '4') this.view = '3';
        if (!this.sidebar && this.view === '3') this.view = '4';
      },
      loadMore() {
        const from = this.shown;
        this.shown = Math.min(this.results.length, this.shown + this.perPage); this.syncUrl();
        this.$nextTick(() => { const el = this.$el.querySelector(`[data-index="${from}"] a, [data-index="${from}"] button`); el && el.focus({ preventScroll: true }); });
      },
      goPage(n) {
        this.page = Math.min(this.pages, Math.max(1, n)); this.flash();
        this.$nextTick(() => { const el = this.$refs.results; el && window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 24, behavior: 'smooth' }); });
      },
      get pageList() {
        const n = this.pages, c = this.page, out = [];
        for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - c) <= 1) out.push(i); else if (out[out.length - 1] !== '…') out.push('…');
        return out;
      },

      // ---- active chips ----
      get activeChips() {
        const f = this.f, out = [];
        f.cats.forEach((h) => out.push({ key: 'c' + h, label: (Theme.collections.find((c) => c.handle === h) || { title: h }).title, rm: () => this.toggle('cats', h) }));
        if (f.avail) out.push({ key: 'avail', label: 'In stock', rm: () => { f.avail = false; } });
        if (f.sale) out.push({ key: 'sale', label: 'On sale', rm: () => { f.sale = false; } });
        if (f.min != null || f.max != null) out.push({ key: 'price', label: `$${f.min ?? this.bounds[0]} – $${f.max ?? this.bounds[1]}`, rm: () => { f.min = null; f.max = null; this.resetSlider(); } });
        f.sizes.forEach((s) => out.push({ key: 's' + s, label: `Size ${s}`, rm: () => this.toggle('sizes', s) }));
        f.colors.forEach((c) => out.push({ key: 'k' + c, label: c, swatch: (this.colorValues.find((x) => x[0] === c) || [])[1] || (THEME.colors || {})[c], rm: () => this.toggle('colors', c) }));
        f.types.forEach((t) => out.push({ key: 't' + t, label: t, rm: () => this.toggle('types', t) }));
        if (f.rating) out.push({ key: 'rating', label: `${f.rating}★ & up`, rm: () => { f.rating = 0; } });
        return out;
      },
      get activeCount() { return this.activeChips.length; },
      clearAll() { this.f = emptyFilters(); this.resetSlider(); },

      // ---- dual-thumb price slider ----
      resetSlider() { const [a, b] = this.bounds; this.pmin = this.f.min ?? a; this.pmax = this.f.max ?? b; },
      slide(which) {
        this.pmin = Number(this.pmin); this.pmax = Number(this.pmax);
        if (which === 'min' && this.pmin > this.pmax - 1) this.pmin = this.pmax - 1;
        if (which === 'max' && this.pmax < this.pmin + 1) this.pmax = this.pmin + 1;
      },
      commitPrice() {
        const [a, b] = this.bounds;
        let lo = Math.max(a, Math.min(Number(this.pmin) || a, b)), hi = Math.min(b, Math.max(Number(this.pmax) || b, a));
        if (lo > hi) [lo, hi] = [hi, lo];
        this.pmin = lo; this.pmax = hi;
        this.f.min = lo > a ? lo : null; this.f.max = hi < b ? hi : null;
      },
      /* price histogram above the slider: 14 bins of the products matching every other facet */
      get hist() {
        const [a, b] = this.bounds, n = 14, bins = Array(n).fill(0);
        if (b <= a) return [];
        this.facet('price').forEach((p) => { bins[Math.min(n - 1, Math.floor(((p.price / 100 - a) / (b - a)) * n))]++; });
        const max = Math.max(1, ...bins), w = (b - a) / n;
        return bins.map((c, i) => ({ h: c ? 18 + (c / max) * 82 : 6, inRange: a + w * (i + 0.5) >= this.pmin && a + w * (i + 0.5) <= this.pmax }));
      },
      pct(v) { const [a, b] = this.bounds; return b > a ? ((v - a) / (b - a)) * 100 : 0; },

      // ---- skeleton flash when results change ----
      flash() { this.loading = true; clearTimeout(this._t); this._t = setTimeout(() => { this.loading = false; }, 420); },
      onChange() { this.page = 1; this.shown = this.perPage; this.flash(); this.syncUrl(); },

      // ---- URL <-> state ----
      readUrl() {
        const Q = new URLSearchParams(location.search), f = this.f;
        f.avail = Q.get('avail') === '1'; f.sale = Q.get('sale') === '1';
        f.min = Q.get('min') ? Number(Q.get('min')) : null; f.max = Q.get('max') ? Number(Q.get('max')) : null;
        f.sizes = csv(Q.get('size')); f.colors = csv(Q.get('color')); f.types = csv(Q.get('type')); f.cats = csv(Q.get('cat'));
        f.rating = Number(Q.get('rating')) || 0;
      },
      urlExtra() { /* sections add their own keys (collection / q / tab) */ },
      syncUrl() {
        const f = this.f, Q = new URLSearchParams();
        this.urlExtra(Q);
        if (this.sort !== this.defaultSort) Q.set('sort', this.sort);
        if (f.cats.length) Q.set('cat', f.cats.join(','));
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

      openFilters() { Alpine.store('ui').open('filters'); },
      get filtersOpen() { return Alpine.store('ui').drawer === 'filters'; },
      get filtersVisible() { return this.desktop ? this.sidebar : this.filtersOpen; },

      init() {
        this.readUrl();
        this.setup && this.setup();
        this.resetSlider();
        if (this.f.sizes.length || this.f.colors.length) this.groups.size = this.groups.color = true;
        if (this.f.types.length) this.groups.type = true;
        if (this.f.rating) this.groups.rating = true;
        this.shown = this.paging === 'pages' ? this.perPage : Math.max(this.perPage, this.page * this.perPage);
        mq.addEventListener('change', (e) => { this.desktop = e.matches; if (e.matches && this.filtersOpen) Alpine.store('ui').close(); });
        window.addEventListener('resize', () => { this.vw = window.innerWidth; }, { passive: true });
        this.$watch('f', () => this.onChange());
        this.$watch('sort', () => this.onChange());
        this.$watch('view', () => { this.flash(); this.syncUrl(); });
        this.$watch('cols', () => this.syncUrl());
        this.$watch('page', () => this.syncUrl());
        setTimeout(() => { this.loading = false; }, 500);   // first paint: skeleton while the collection "loads"
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
        if (!n.nodeValue.trim() || n.parentElement.closest('script,style,button[role=radio]')) return;
        re.lastIndex = 0; if (!re.test(n.nodeValue)) return; re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        n.nodeValue.split(re).forEach((part, i) => {
          if (!part) return;
          if (i % 2) { const m = document.createElement('mark'); m.dataset.hl = ''; m.className = 'ween-hl'; m.textContent = part; frag.appendChild(m); }
          else frag.appendChild(document.createTextNode(part));
        });
        n.replaceWith(frag);
      });
    });
  }

  /* Levenshtein distance for "Did you mean…" */
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

  window.WeenFacets = { create, extend, highlight, distance, SORTS, onSale };
})();
