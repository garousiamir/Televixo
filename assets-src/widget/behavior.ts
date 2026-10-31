/**
 * Behavioural signals for rules: visible time on page (paused while the tab
 * is hidden), scroll depth, inactivity and desktop exit intent (only with a
 * fine pointer; there is no reliable mobile exit intent, so none is guessed).
 */
export class Behavior {
	visibleMs = 0;
	maxScroll = 0;
	lastInput = Date.now();
	exitIntent = false;
	private since = document.visibilityState === 'visible' ? Date.now() : 0;
	private listeners: (() => void)[] = [];
	private timer = 0;

	constructor(private onChange: () => void) {
		const vis = () => {
			if (document.visibilityState === 'visible') this.since = Date.now();
			else { this.flush(); this.since = 0; }
		};
		const scroll = () => {
			const h = document.documentElement.scrollHeight - window.innerHeight;
			const pct = h > 0 ? Math.round((window.scrollY / h) * 100) : 100;
			if (pct > this.maxScroll) { this.maxScroll = pct; this.onChange(); }
		};
		const input = () => { this.lastInput = Date.now(); };
		const out = (e: MouseEvent) => {
			if (!e.relatedTarget && e.clientY <= 0 && window.matchMedia('(pointer: fine)').matches && !this.exitIntent) {
				this.exitIntent = true; this.onChange();
			}
		};
		this.on(document, 'visibilitychange', vis);
		this.on(window, 'scroll', scroll, { passive: true });
		for (const ev of ['mousemove', 'keydown', 'touchstart', 'scroll']) this.on(window, ev, input, { passive: true });
		this.on(document, 'mouseout', out as EventListener);
		this.timer = window.setInterval(() => this.onChange(), 1000);
		scroll();
	}

	private on(t: EventTarget, ev: string, fn: EventListener, opts?: AddEventListenerOptions) {
		t.addEventListener(ev, fn, opts);
		this.listeners.push(() => t.removeEventListener(ev, fn, opts));
	}

	private flush() {
		if (this.since) { this.visibleMs += Date.now() - this.since; this.since = Date.now(); }
	}

	/** Resets per-page counters after an in-page (SPA) navigation. */
	resetPage() {
		this.visibleMs = 0; this.maxScroll = 0; this.exitIntent = false;
		this.since = document.visibilityState === 'visible' ? Date.now() : 0;
	}

	snapshot() {
		this.flush();
		return {
			time_on_page: Math.floor(this.visibleMs / 1000),
			scroll_depth: this.maxScroll,
			inactivity: Math.floor((Date.now() - this.lastInput) / 1000),
			exit_intent: this.exitIntent,
		};
	}

	destroy() { clearInterval(this.timer); this.listeners.forEach((f) => f()); }
}
