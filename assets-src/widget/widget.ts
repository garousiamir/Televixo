/**
 * Televixo visitor widget.
 *
 * Renders inside a shadow root so theme CSS cannot leak in and widget CSS
 * cannot leak out. All visitor/operator text is inserted with textContent.
 */
import { Api, ApiError } from './api';
import { Behavior } from './behavior';
import { append, clear, h, icon, linkify } from './dom';
import { I18n, I18nData } from './i18n';
import { Poller } from './poller';
import { Action, Ctx, needs, resolve, Rule, wildcard } from './rules';
import { Store } from './storage';

export interface Boot {
	config: any;
	page: Ctx;
	css: string;
	i18n: I18nData;
	preview?: boolean;
	mount?: HTMLElement;
}

interface Msg {
	key: string;
	id?: string;
	cursor: number;
	author: 'visitor' | 'operator' | 'automation' | 'system' | 'local';
	author_name?: string;
	body: string;
	created_at: string;
	state?: string | null;
	attachments?: any[];
	pending?: boolean;
	failed?: boolean;
	client_id?: string;
	attIds?: string[];
	errorText?: string;
}

interface Upload {
	key: string;
	file: Blob;
	name: string;
	progress: number;
	status: 'uploading' | 'done' | 'error';
	id?: string;
	preview?: string;
	abort?: () => void;
	error?: string;
}

type View = 'chat' | 'prechat' | 'offline' | 'kb' | 'article' | 'offline_sent';

const EMOJI = '😀 😃 😄 😁 😅 😂 🙂 😉 😊 😍 🤔 😐 😕 😢 😮 😎 👍 👎 👏 🙏 👋 💪 🎉 ❤️ 🔥 ✅ ❌ ⭐ 📦 🚚 💳 🛒 📎 📷 ⏰ ❓'.split(' ');

export class Widget {
	private cfg: any;
	private t: I18n;
	private api: Api;
	private local: Store;
	private sess: Store;
	private host!: HTMLElement;
	private root!: ShadowRoot;
	private el: Record<string, HTMLElement> = {};
	private messages = new Map<string, Msg>();
	private lastCursor = 0;
	private hasOlder = false;
	private conversation: any = null;
	private availability: any = null;
	private context: any = {};
	private session: Promise<void> | null = null;
	private sessionReady = false;
	private open = false;
	private expanded = false;
	private view: View = 'chat';
	private unread = 0;
	private uploads: Upload[] = [];
	private poller: Poller | null = null;
	private behavior: Behavior | null = null;
	private dismissed = false;
	private attentionShown = false;
	private typedThisSession = false;
	private repliedThisSession = false;
	private launcherVisible = true;
	private department = '';
	private greeting = '';
	private autoMessage = '';
	private welcomeOptions: any[] = [];
	private consent = true;
	private path: string;
	private sound: boolean;
	private audio: AudioContext | null = null;
	private interacted = false;
	private liveQueue: string[] = [];
	private liveTimer = 0;
	private renderQueued = false;
	private readTimer = 0;
	private typingSent = 0;
	private recorder: MediaRecorder | null = null;
	private connError = false;
	private prechatDone = false;
	private notifyAsked = false;
	private ended = false;
	private rated = false;
	private avoidTimer = 0;
	private listeners: Record<string, ((d?: any) => void)[]> = {};

	constructor(private boot: Boot) {
		this.cfg = boot.config;
		this.t = new I18n(boot.i18n);
		this.api = new Api(this.cfg.rest);
		const triggersNeedConsent = (window as any).televixoConsent === false;
		this.consent = !triggersNeedConsent;
		this.local = new Store('local', this.consent);
		this.sess = new Store('session', this.consent);
		this.path = location.pathname;
		this.sound = this.local.get('sound', !!this.cfg.appearance.sound);
		this.greeting = this.cfg.texts.greeting || '';
		this.prechatDone = this.sess.get('prechat_done', false);
		this.dismissed = this.sess.get('dismissed', false);
	}

	/* ------------------------------------------------------------------ boot */

	mount(): void {
		if (!this.cfg.enabled || this.excluded(this.path)) return;
		this.host = document.createElement('div');
		this.host.id = 'televixo-root';
		this.host.setAttribute('data-televixo', '');
		const dir = this.cfg.rtl || document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
		if (this.boot.preview && this.boot.mount) {
			this.host.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
			this.boot.mount.appendChild(this.host);
		} else {
			(document.body || document.documentElement).appendChild(this.host);
		}
		this.root = this.host.attachShadow({ mode: 'open' });
		this.injectFonts();
		const link = h('link', { rel: 'stylesheet', href: this.boot.css });
		this.root.appendChild(link);
		this.build(dir);
		this.applyAppearance();
		if (!this.local.get('first_seen', 0)) this.local.set('first_seen', Date.now());
		else this.local.set('returning', true);

		if (this.boot.preview) {
			this.previewContent();
			return;
		}
		this.behavior = new Behavior(() => this.evaluateRules());
		this.watchNavigation();
		this.watchCollisions();
		this.evaluateRules();
		const rulesNeed = needs(this.cfg.rules || []);
		if (this.local.get('has_session', false) || rulesNeed.session || this.cfg.offline.behavior === 'hide') {
			const idle = (window as any).requestIdleCallback || ((f: () => void) => setTimeout(f, 300));
			idle(() => this.ensureSession().catch(() => undefined));
		}
		if (this.cfg.greeting.bubble && this.greeting && !this.dismissed && !this.sess.get('greeted', false)) {
			setTimeout(() => {
				if (!this.open && !this.attentionShown) { this.showTeaser(this.greeting, 0, 'greeting'); this.sess.set('greeted', true); }
			}, this.cfg.greeting.delay * 1000);
		}
		document.addEventListener('pointerdown', () => { this.interacted = true; }, { once: true, capture: true });
		window.addEventListener('storage', (e) => this.onStorage(e));
		this.emit('ready');
	}

	private injectFonts(): void {
		if (document.getElementById('televixo-fonts')) return;
		const base = this.boot.css.replace(/widget\.css.*$/, 'fonts/');
		const face = (fam: string, file: string, w: number, range: string) =>
			`@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${base}${file}) format('woff2');unicode-range:${range}}`;
		const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
		const latinExt = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
		const arabic = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
		const css = [400, 500].map((w) => face('Televixo Sans', `hanken-grotesk-latin-${w}.woff2`, w, latin) + face('Televixo Sans', `hanken-grotesk-latin-ext-${w}.woff2`, w, latinExt) + face('Televixo Sans', `vazirmatn-arabic-${w}.woff2`, w, arabic)).join('');
		const style = document.createElement('style');
		style.id = 'televixo-fonts';
		style.textContent = css;
		document.head.appendChild(style);
	}

	private excluded(path: string): boolean {
		return (this.cfg.excluded_paths || []).some((p: string) => wildcard(p, path));
	}

	/* ------------------------------------------------------------- structure */

	private build(dir: string): void {
		const t = this.t;
		const ap = this.cfg.appearance;
		const launcherInner = [
			ap.avatar ? h('img', { class: 'tvx-launcher__avatar', src: ap.avatar, alt: '' }) : icon(ap.icon, ap.custom_icon),
			ap.variant === 'pill' ? h('span', { class: 'tvx-launcher__label' }, this.cfg.texts.label) : null,
			h('span', { class: 'tvx-launcher__dot', hidden: true }),
			h('span', { class: 'tvx-launcher__badge', hidden: true, 'aria-hidden': 'true' }),
		];
		this.el.launcher = h('button', {
			type: 'button',
			class: `tvx-launcher tvx-launcher--${ap.variant}`,
			'aria-controls': 'tvx-panel',
			'aria-expanded': 'false',
			'aria-label': ap.variant === 'pill' ? null : this.cfg.texts.label,
			onclick: () => this.toggle(),
		}, ...launcherInner);

		this.el.teaser = h('div', { class: 'tvx-teaser', hidden: true },
			h('button', { type: 'button', class: 'tvx-teaser__body', onclick: () => this.teaserClick() }, h('span', { class: 'tvx-teaser__text' })),
			h('button', { type: 'button', class: 'tvx-teaser__close', 'aria-label': t.t('dismiss'), onclick: () => this.dismissTeaser() }, icon('x')));

		this.el.statusDot = h('span', { class: 'tvx-status__dot' });
		this.el.statusText = h('span', { class: 'tvx-status__text' });
		this.el.title = h('span', { id: 'tvx-title', class: 'tvx-head__title' }, this.cfg.texts.title);
		this.el.expand = h('button', { type: 'button', class: 'tvx-iconbtn tvx-glass tvx-only-wide', 'aria-label': t.t('expand'), onclick: () => this.toggleExpand() }, icon('expand'));
		this.el.moreBtn = h('button', { type: 'button', class: 'tvx-iconbtn tvx-glass', 'aria-label': t.t('more'), 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleMenu() }, icon('more'));
		this.el.head = h('header', { class: 'tvx-head' },
			h('div', { class: 'tvx-head__id' },
				ap.avatar ? h('span', { class: 'tvx-head__avatar' }, h('img', { src: ap.avatar, alt: '' })) : h('span', { class: 'tvx-head__avatar tvx-head__avatar--icon' }, icon(ap.icon === 'custom' ? 'chat' : ap.icon)),
				h('div', { class: 'tvx-head__text' }, this.el.title, h('span', { class: 'tvx-status' }, this.el.statusDot, this.el.statusText))),
			h('div', { class: 'tvx-head__actions' }, this.el.moreBtn, this.el.expand,
				h('button', { type: 'button', class: 'tvx-iconbtn tvx-glass', 'aria-label': t.t('close'), onclick: () => this.close(true) }, icon('x'))));

		this.el.menu = h('div', { class: 'tvx-menu', role: 'menu', hidden: true });
		this.el.conn = h('div', { class: 'tvx-conn', role: 'status', hidden: true }, t.t('reconnecting'));
		this.el.log = h('ol', { class: 'tvx-log', 'aria-label': t.t('messages') });
		this.el.older = h('button', { type: 'button', class: 'tvx-older', hidden: true, onclick: () => this.loadOlder() }, t.t('load_older'));
		this.el.latest = h('button', { type: 'button', class: 'tvx-latest', hidden: true, onclick: () => this.scrollToBottom(true) }, icon('down'), h('span', { class: 'tvx-latest__n' }));
		this.el.scroller = h('div', { class: 'tvx-scroll tvx-thin', onscroll: () => this.onScroll() }, this.el.older, this.el.log);
		this.el.alt = h('div', { class: 'tvx-alt tvx-thin', hidden: true });
		this.el.body = h('div', { class: 'tvx-body' }, this.el.scroller, this.el.alt, this.el.latest);
		this.el.chips = h('div', { class: 'tvx-chips tvx-noscroll' });
		this.el.uploads = h('ul', { class: 'tvx-uploads', hidden: true });

		this.el.input = h('textarea', {
			id: 'tvx-input', rows: '1', class: 'tvx-input', placeholder: t.t('placeholder'), autocomplete: 'off',
			maxlength: String(this.cfg.limits.max_chars), 'aria-label': t.t('input_label'),
			onkeydown: (e: Event) => this.onKey(e as KeyboardEvent), oninput: () => this.onInput(),
		});
		this.el.file = h('input', { type: 'file', class: 'tvx-sr', tabindex: '-1', 'aria-hidden': 'true', accept: this.acceptAttr(), onchange: (e: Event) => this.onFiles((e.target as HTMLInputElement).files) });
		this.el.attach = h('button', { type: 'button', class: 'tvx-tool', 'aria-label': t.t('attach'), hidden: !this.cfg.uploads.enabled, onclick: () => (this.el.file as HTMLInputElement).click() }, icon('clip'));
		this.el.emojiBtn = h('button', { type: 'button', class: 'tvx-tool', 'aria-label': t.t('emoji'), 'aria-expanded': 'false', onclick: () => this.toggleEmoji() }, icon('smile'));
		this.el.mic = h('button', { type: 'button', class: 'tvx-tool', 'aria-label': t.t('record'), hidden: !this.voiceSupported(), onclick: () => this.toggleRecord() }, icon('mic'));
		this.el.send = h('button', { type: 'submit', class: 'tvx-send tvx-btn-dark', disabled: true }, t.t('send'));
		this.el.emoji = h('div', { class: 'tvx-emoji', role: 'group', 'aria-label': t.t('emoji'), hidden: true },
			...EMOJI.map((e) => h('button', { type: 'button', class: 'tvx-emoji__btn', onclick: () => this.insertText(e) }, e)));
		this.el.composer = h('form', { class: 'tvx-composer tvx-field', onsubmit: (e: Event) => { e.preventDefault(); this.submit(); } },
			this.el.attach, this.el.file, this.el.input, this.el.emojiBtn, this.el.mic, this.el.send);
		this.el.notify = h('div', { class: 'tvx-notify', hidden: true });
		this.el.live = h('div', { class: 'tvx-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });

		this.el.panel = h('section', { id: 'tvx-panel', class: 'tvx-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'tvx-title', hidden: true, onkeydown: (e: Event) => this.onPanelKey(e as KeyboardEvent) },
			this.el.head, this.el.menu, this.el.conn, this.el.body, this.el.notify, this.el.chips, this.el.uploads, this.el.emoji, this.el.composer, this.el.live);

		this.el.wrap = h('div', { class: 'tvx', dir, 'data-pos': this.position(dir) }, this.el.panel, this.el.teaser, this.el.launcher);
		this.root.appendChild(this.el.wrap);
		this.renderMenu();
		this.renderChips();
		this.renderStatus();
	}

	private position(dir: string): 'left' | 'right' {
		const p = this.cfg.appearance.position;
		if (p === 'left' || p === 'right') return p;
		const endIsRight = dir === 'ltr';
		return (p === 'end') === endIsRight ? 'right' : 'left';
	}

	private applyAppearance(): void {
		const ap = this.cfg.appearance;
		const w = this.el.wrap;
		w.style.setProperty('--tvx-ox', ap.offset_x + 'px');
		w.style.setProperty('--tvx-oy', ap.offset_y + 'px');
		w.style.setProperty('--tvx-mox', ap.mobile_offset_x + 'px');
		w.style.setProperty('--tvx-moy', ap.mobile_offset_y + 'px');
		w.style.setProperty('--tvx-size', ap.size + 'px');
		w.style.setProperty('--tvx-msize', ap.mobile_size + 'px');
		w.style.setProperty('--tvx-accent', ap.accent || '#1c1c1c');
		this.host.style.position = this.boot.preview ? 'absolute' : 'relative';
		this.host.style.zIndex = String(ap.z_index);
		w.classList.toggle('tvx--entrance', !!ap.entrance && !this.reducedMotion());
		if (this.boot.preview) w.classList.add('tvx--preview');
	}

	private reducedMotion(): boolean {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	private acceptAttr(): string {
		const map: Record<string, string> = { jpg: '.jpg,.jpeg,image/jpeg', png: '.png,image/png', gif: '.gif,image/gif', webp: '.webp,image/webp', pdf: '.pdf,application/pdf', txt: '.txt,text/plain', csv: '.csv,text/csv', docx: '.docx', xlsx: '.xlsx', ogg: '.ogg,audio/ogg', mp3: '.mp3,audio/mpeg', m4a: '.m4a,audio/mp4' };
		return (this.cfg.uploads.accept || []).map((e: string) => map[e]).filter(Boolean).join(',');
	}

	/* ---------------------------------------------------------- session/api */

	private ensureSession(): Promise<void> {
		if (this.session) return this.session;
		this.session = (async () => {
			const s: any = await this.api.post('session', { page: this.path });
			this.api.csrf = s.csrf;
			this.sessionReady = true;
			this.local.set('has_session', true, 30 * 864e5);
			this.availability = s.availability;
			this.context = s.context || {};
			this.setConversation(s.conversation);
			if (this.conversation?.active) {
				await this.loadLatest();
			}
			this.renderStatus();
			this.evaluateRules();
			this.startPoller();
		})().catch((e) => {
			this.session = null;
			this.handleError(e);
			throw e;
		});
		return this.session;
	}

	private setConversation(c: any): void {
		const prevId = this.conversation?.id;
		this.conversation = c;
		if (c && prevId && prevId !== c.id) { this.messages.clear(); this.lastCursor = 0; }
		this.ended = !!c && !c.active;
		this.rated = !!c?.rated;
		if (c && !c.active && prevId !== c.id) this.ended = true;
		this.poller?.setMode(this.pollMode());
		this.queueRender();
	}

	private pollMode(): 'open' | 'closed' | 'idle' {
		if (!this.conversation?.active) return this.open && this.conversation ? 'open' : 'idle';
		return this.open ? 'open' : 'closed';
	}

	private startPoller(): void {
		if (this.poller || this.boot.preview) return;
		this.poller = new Poller(
			() => this.poll(),
			(payload) => this.applyUpdate(payload, true),
			(s) => { this.connError = s === 'error'; this.el.conn.hidden = !this.connError; },
		);
		this.poller.setMode(this.pollMode());
	}

	private async poll(): Promise<boolean> {
		if (!this.conversation) return false;
		const data: any = await this.api.get(`conversations/${this.conversation.id}/updates?after=${this.lastCursor}`);
		this.poller?.relay(data);
		return this.applyUpdate(data, false);
	}

	/** Merges new messages by cursor (duplicates from multiple tabs are ignored). */
	private applyUpdate(data: any, relayed: boolean): boolean {
		if (!data || (this.conversation && data.conversation && data.conversation.id !== this.conversation.id)) return false;
		let gotIncoming = false;
		const before = this.lastCursor;
		for (const m of data.items || []) {
			if (this.merge(m) && m.author !== 'visitor' && m.cursor > before) {
				gotIncoming = true;
				this.onIncoming(m, relayed);
			}
		}
		if (data.conversation) {
			const wasActive = this.conversation?.active;
			this.conversation = data.conversation;
			this.rated = !!data.conversation.rated;
			if (wasActive && !data.conversation.active) { this.ended = true; this.announce(this.t.t('chat_ended')); }
		}
		if (data.availability) this.availability = data.availability;
		this.renderStatus();
		this.queueRender();
		if (this.open && this.isVisible()) this.markReadSoon();
		return gotIncoming || (data.items || []).length > 0;
	}

	private merge(m: any): boolean {
		const key = 'c' + m.cursor;
		if (this.messages.has(key)) {
			Object.assign(this.messages.get(key)!, { state: m.state, body: m.body, attachments: m.attachments });
			return false;
		}
		for (const [k, local] of this.messages) {
			if (local.pending !== undefined && local.id && local.id === m.id) this.messages.delete(k);
		}
		this.messages.set(key, { key, ...m });
		if (m.cursor > this.lastCursor) this.lastCursor = m.cursor;
		return true;
	}

	private async loadLatest(): Promise<void> {
		if (!this.conversation) return;
		const data: any = await this.api.get(`conversations/${this.conversation.id}/messages?limit=30`);
		for (const m of data.items) this.merge(m);
		this.hasOlder = data.has_more;
		this.unread = (data.items as any[]).filter((m) => m.author !== 'visitor' && m.cursor > (this.conversation.visitor_read || 0)).length;
		this.renderBadge();
		this.queueRender(true);
	}

	private async loadOlder(): Promise<void> {
		const oldest = Math.min(...[...this.messages.values()].filter((m) => m.cursor > 0).map((m) => m.cursor));
		if (!this.conversation || !isFinite(oldest)) return;
		const sc = this.el.scroller;
		const prevHeight = sc.scrollHeight;
		const data: any = await this.api.get(`conversations/${this.conversation.id}/messages?before=${oldest}&limit=30`);
		for (const m of data.items) this.merge(m);
		this.hasOlder = data.has_more;
		this.renderLog();
		sc.scrollTop = sc.scrollHeight - prevHeight;
	}

	private handleError(e: unknown): void {
		const err = e as ApiError;
		const map: Record<string, string> = { rate_limited: 'rate_limited', session_required: 'session_expired', csrf_failed: 'session_expired', visitor_blocked: 'blocked' };
		const key = map[err?.code] || 'error_generic';
		if (err?.code === 'session_required' || err?.code === 'csrf_failed') {
			this.session = null; this.sessionReady = false; this.local.remove('has_session');
		}
		if (err?.code === 'visitor_blocked') { this.el.composer.hidden = true; }
		this.flash(err?.message && err.status !== 0 ? err.message : this.t.t(key));
	}

	private flash(text: string): void {
		this.el.notify.hidden = false;
		clear(this.el.notify);
		append(this.el.notify, [h('span', {}, text), h('button', { type: 'button', class: 'tvx-link', onclick: () => { this.el.notify.hidden = true; } }, this.t.t('dismiss'))]);
		this.announce(text);
	}

	/* --------------------------------------------------------- open / close */

	toggle(): void { this.open ? this.close(true) : this.openPanel(); }

	async openPanel(source: 'user' | 'rule' = 'user'): Promise<void> {
		if (this.open) return;
		this.open = true;
		this.hideTeaser();
		this.el.panel.hidden = false;
		this.el.wrap.classList.add('tvx--open');
		this.el.launcher.setAttribute('aria-expanded', 'true');
		this.el.launcher.setAttribute('aria-label', this.t.t('close'));
		this.applyModal();
		this.poller?.setMode(this.pollMode());
		if (source === 'user') this.interacted = true;
		this.sess.set('opened', true);
		this.restoreDraft();
		this.chooseView();
		this.renderAll();
		requestAnimationFrame(() => this.focusFirst());
		this.emit('open');
		try {
			await this.ensureSession();
			this.chooseView();
			this.renderAll();
			this.scrollToBottom(false);
			this.markReadSoon();
		} catch { /* error already shown */ }
	}

	close(user = false): void {
		if (!this.open) return;
		this.open = false;
		this.el.panel.hidden = true;
		this.el.wrap.classList.remove('tvx--open');
		this.el.launcher.setAttribute('aria-expanded', 'false');
		this.el.launcher.setAttribute('aria-label', this.cfg.appearance.variant === 'pill' ? '' : this.cfg.texts.label);
		if (this.cfg.appearance.variant === 'pill') this.el.launcher.removeAttribute('aria-label');
		this.el.menu.hidden = true;
		this.el.emoji.hidden = true;
		this.poller?.setMode(this.pollMode());
		if (user) {
			this.dismissed = true;
			this.sess.set('dismissed', true);
			this.el.launcher.focus();
		}
		this.emit('close');
	}

	private applyModal(): void {
		// Small screens open as a full-screen dialog: modal semantics apply.
		const full = this.expanded && window.matchMedia('(max-width: 640px)').matches;
		this.el.panel.setAttribute('aria-modal', full ? 'true' : 'false');
		this.el.wrap.classList.toggle('tvx--expanded', this.expanded);
	}

	private toggleExpand(): void {
		this.expanded = !this.expanded;
		this.el.expand.setAttribute('aria-label', this.t.t(this.expanded ? 'collapse' : 'expand'));
		clear(this.el.expand);
		this.el.expand.appendChild(icon(this.expanded ? 'collapse' : 'expand'));
		this.applyModal();
		this.scrollToBottom(false);
	}

	private focusFirst(): void {
		const target = this.view === 'chat' ? this.el.input : this.el.alt.querySelector<HTMLElement>('input,select,textarea,button');
		target?.focus();
	}

	private onPanelKey(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			if (!this.el.menu.hidden) { this.toggleMenu(false); this.el.moreBtn.focus(); return; }
			if (!this.el.emoji.hidden) { this.toggleEmoji(false); this.el.emojiBtn.focus(); return; }
			e.stopPropagation();
			this.close(true);
			return;
		}
		if (e.key === 'Tab' && this.el.panel.getAttribute('aria-modal') === 'true') {
			const f = [...this.el.panel.querySelectorAll<HTMLElement>('button:not([disabled]):not([hidden]),textarea,input:not([type=file]),select,a[href]')].filter((x) => x.offsetParent !== null);
			if (!f.length) return;
			const first = f[0], last = f[f.length - 1];
			const active = this.root.activeElement;
			if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
			else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
		}
	}

	private isVisible(): boolean { return document.visibilityState === 'visible'; }

	/* ----------------------------------------------------------------- views */

	private chooseView(): void {
		if (this.view === 'kb' || this.view === 'article' || this.view === 'offline_sent') return;
		const st = this.availability?.state;
		const offline = st && ['offline', 'closed', 'away'].includes(st) && st !== 'away';
		const hasConv = !!this.conversation;
		if (!hasConv && offline && this.cfg.offline.behavior === 'form') this.view = 'offline';
		else if (!hasConv && this.cfg.prechat.enabled && !this.prechatDone) this.view = 'prechat';
		else this.view = 'chat';
	}

	private renderAll(): void {
		const chat = this.view === 'chat';
		this.el.scroller.hidden = !chat;
		this.el.alt.hidden = chat;
		this.el.composer.hidden = !chat || (this.ended && !!this.conversation) || this.isBlocked();
		this.el.chips.hidden = !chat || this.ended;
		if (chat) this.renderLog();
		else this.renderAlt();
		this.renderChips();
		this.renderUploads();
	}

	private isBlocked(): boolean { return false; }

	private renderAlt(): void {
		const a = this.el.alt;
		clear(a);
		if (this.view === 'prechat') a.appendChild(this.prechatForm());
		else if (this.view === 'offline') a.appendChild(this.offlineForm());
		else if (this.view === 'offline_sent') a.appendChild(h('div', { class: 'tvx-note' }, h('p', {}, this.t.t('offline_sent'))));
		else if (this.view === 'kb') a.appendChild(this.kbView());
	}

	private field(name: string, label: string, mode: string, type = 'text', extra: Record<string, string> = {}): HTMLElement | null {
		if (mode === 'hidden') return null;
		const id = 'tvx-f-' + name;
		const input = type === 'textarea'
			? h('textarea', { id, name, class: 'tvx-input-box', rows: '4', required: mode === 'required', ...extra })
			: h('input', { id, name, type, class: 'tvx-input-box', required: mode === 'required', autocomplete: name === 'name' ? 'name' : name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'off', ...extra });
		return h('div', { class: 'tvx-fld' },
			h('label', { for: id }, label, mode === 'optional' ? h('span', { class: 'tvx-opt' }, ' ' + this.t.t('optional')) : null),
			input,
			h('p', { class: 'tvx-err', id: id + '-err', hidden: true }));
	}

	private prechatForm(): HTMLElement {
		const p = this.cfg.prechat;
		const t = this.t;
		const dep = p.department !== 'hidden' && p.departments.length
			? h('div', { class: 'tvx-fld' }, h('label', { for: 'tvx-f-department' }, t.t('department')),
				h('select', { id: 'tvx-f-department', name: 'department', class: 'tvx-input-box', required: p.department === 'required' },
					h('option', { value: '' }, t.t('choose')), ...p.departments.map((d: any) => h('option', { value: d.key, selected: d.key === this.department }, d.label))),
				h('p', { class: 'tvx-err', id: 'tvx-f-department-err', hidden: true }))
			: null;
		const custom = (p.custom_fields || []).map((cf: any) => cf.type === 'select'
			? h('div', { class: 'tvx-fld' }, h('label', { for: 'tvx-f-cf-' + cf.key }, cf.label),
				h('select', { id: 'tvx-f-cf-' + cf.key, name: 'cf:' + cf.key, class: 'tvx-input-box', required: cf.required }, h('option', { value: '' }, t.t('choose')), ...cf.options.map((o: string) => h('option', { value: o }, o))),
				h('p', { class: 'tvx-err', id: 'tvx-f-cf-' + cf.key + '-err', hidden: true }))
			: this.field('cf:' + cf.key, cf.label, cf.required ? 'required' : 'optional', cf.type === 'textarea' ? 'textarea' : 'text'));
		const consent = p.consent !== 'hidden'
			? h('div', { class: 'tvx-fld tvx-fld--check' },
				h('input', { id: 'tvx-f-consent', name: 'consent', type: 'checkbox', class: 'tvx-check', required: p.consent === 'required' }),
				this.consentLabel('tvx-f-consent'),
				h('p', { class: 'tvx-err', id: 'tvx-f-consent-err', hidden: true }))
			: null;
		const form = h('form', { class: 'tvx-form', novalidate: true, onsubmit: (e: Event) => { e.preventDefault(); this.submitPrechat(form); } },
			this.greeting ? h('p', { class: 'tvx-form__intro' }, this.greeting) : null,
			this.field('name', t.t('name'), p.name),
			this.field('email', t.t('email'), p.email, 'email'),
			this.field('phone', t.t('phone'), p.phone, 'tel'),
			dep, ...custom, consent,
			h('input', { type: 'text', name: 'website', class: 'tvx-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
			h('button', { type: 'submit', class: 'tvx-btn-dark tvx-btn-block' }, t.t('start_chat')));
		return form;
	}

	private consentLabel(id: string): HTMLElement {
		// Consent text is admin-authored and limited to <a href> by wp_kses.
		const label = h('label', { for: id });
		const tpl = document.createElement('template');
		tpl.innerHTML = this.cfg.texts.consent || '';
		const safe = document.createDocumentFragment();
		const walk = (n: Node, out: Node) => {
			n.childNodes.forEach((c) => {
				if (c.nodeType === 3) out.appendChild(document.createTextNode(c.textContent || ''));
				else if (c.nodeName === 'A') {
					const href = (c as HTMLAnchorElement).getAttribute('href') || '';
					if (/^https?:\/\//i.test(href) || href.startsWith('/')) {
						const a = h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, c.textContent || '');
						out.appendChild(a);
					} else out.appendChild(document.createTextNode(c.textContent || ''));
				} else walk(c, out);
			});
		};
		walk(tpl.content, safe);
		label.appendChild(safe.childNodes.length ? safe : document.createTextNode(this.t.t('consent')));
		return label;
	}

	private formData(form: HTMLFormElement): Record<string, any> {
		const out: Record<string, any> = { fields: {} };
		new FormData(form).forEach((v, k) => {
			if (k.startsWith('cf:')) out.fields[k.slice(3)] = String(v);
			else out[k] = String(v);
		});
		const consent = form.querySelector<HTMLInputElement>('input[name=consent]');
		if (consent) out.consent = consent.checked;
		return out;
	}

	private showFieldErrors(form: HTMLFormElement, errors: Record<string, string>): void {
		form.querySelectorAll<HTMLElement>('.tvx-err').forEach((e) => { e.hidden = true; e.textContent = ''; });
		form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
		let first: HTMLElement | null = null;
		for (const [k, msg] of Object.entries(errors)) {
			const id = 'tvx-f-' + (['name', 'email', 'phone', 'department', 'consent', 'message'].includes(k) ? k : 'cf-' + k);
			const input = form.querySelector<HTMLElement>('#' + CSS.escape(id)) || form.querySelector<HTMLElement>(`[name="cf:${k}"]`);
			const err = form.querySelector<HTMLElement>('#' + CSS.escape(id + '-err'));
			if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', id + '-err'); first ||= input; }
			if (err) { err.textContent = msg; err.hidden = false; }
		}
		first?.focus();
	}

	private clientValidate(form: HTMLFormElement): Record<string, string> {
		const errs: Record<string, string> = {};
		form.querySelectorAll<HTMLInputElement>('[required]').forEach((i) => {
			const name = i.name.startsWith('cf:') ? i.name.slice(3) : i.name;
			if ((i.type === 'checkbox' && !i.checked) || (i.type !== 'checkbox' && !i.value.trim())) errs[name] = this.t.t('required');
			else if (i.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value)) errs[name] = this.t.t('email');
		});
		return errs;
	}

	private async submitPrechat(form: HTMLFormElement): Promise<void> {
		const errs = this.clientValidate(form);
		if (Object.keys(errs).length) { this.showFieldErrors(form, errs); return; }
		const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
		btn.disabled = true;
		try {
			await this.ensureSession();
			await this.startConversation(this.formData(form));
			this.prechatDone = true;
			this.sess.set('prechat_done', true);
			this.view = 'chat';
			this.renderAll();
			this.el.input.focus();
		} catch (e) {
			const err = e as ApiError;
			if (err.data?.fields) this.showFieldErrors(form, err.data.fields as Record<string, string>);
			else this.handleError(e);
		} finally {
			btn.disabled = false;
		}
	}

	private offlineForm(): HTMLElement {
		const t = this.t;
		const st = this.availability?.state;
		const intro = st === 'away' ? this.cfg.texts.away : this.cfg.texts.offline;
		const form = h('form', { class: 'tvx-form', novalidate: true, onsubmit: (e: Event) => { e.preventDefault(); this.submitOffline(form); } },
			h('p', { class: 'tvx-form__intro' }, intro),
			this.field('name', t.t('name'), 'optional'),
			this.field('email', t.t('email'), 'required', 'email'),
			this.field('message', t.t('message'), 'required', 'textarea'),
			h('input', { type: 'text', name: 'website', class: 'tvx-hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
			h('button', { type: 'submit', class: 'tvx-btn-dark tvx-btn-block' }, t.t('leave_message')));
		return form;
	}

	private async submitOffline(form: HTMLFormElement): Promise<void> {
		const errs = this.clientValidate(form);
		if (Object.keys(errs).length) { this.showFieldErrors(form, errs); return; }
		try {
			await this.ensureSession();
			const data = this.formData(form);
			const res: any = await this.api.post('offline', { ...data, context: this.pageContext(), client_id: this.clientId() });
			this.setConversation(res.conversation);
			this.view = 'offline_sent';
			this.renderAll();
			this.announce(t(this, 'offline_sent'));
		} catch (e) {
			const err = e as ApiError;
			if (err.data?.fields) this.showFieldErrors(form, err.data.fields as Record<string, string>);
			else this.handleError(e);
		}
	}

	private kbView(): HTMLElement {
		const t = this.t;
		const list = h('ul', { class: 'tvx-kb__list' });
		const detail = h('div', { class: 'tvx-kb__article', hidden: true });
		const show = (items: any[]) => {
			clear(list);
			if (!items.length) list.appendChild(h('li', { class: 'tvx-kb__empty' }, t.t('no_results')));
			for (const it of items) {
				list.appendChild(h('li', {}, h('button', { type: 'button', class: 'tvx-kb__item', onclick: () => {
					clear(detail);
					append(detail, [h('h3', {}, it.title), h('p', { class: 'tvx-pre' }, ...linkify(it.body)),
						h('button', { type: 'button', class: 'tvx-chip', onclick: () => { this.view = 'chat'; this.renderAll(); this.el.input.focus(); } }, t.t('talk_to_human'))]);
					detail.hidden = false; list.hidden = true; (detail.querySelector('h3') as HTMLElement).setAttribute('tabindex', '-1'); (detail.querySelector('h3') as HTMLElement).focus();
				} }, it.title, icon('arrowUR'))));
			}
		};
		let timer = 0;
		const search = h('input', { type: 'search', class: 'tvx-input-box', 'aria-label': t.t('search_help'), placeholder: t.t('search_help'), oninput: (e: Event) => {
			clearTimeout(timer);
			const q = (e.target as HTMLInputElement).value;
			timer = window.setTimeout(async () => { try { const r: any = await this.api.get('kb?q=' + encodeURIComponent(q)); show(r.items); } catch { /* ignore */ } }, 250);
		} });
		show(this.cfg.kb || []);
		this.api.get('kb').then((r: any) => show(r.items)).catch(() => undefined);
		return h('div', { class: 'tvx-kb' },
			h('button', { type: 'button', class: 'tvx-link tvx-back', onclick: () => { this.view = 'chat'; this.chooseView(); this.renderAll(); } }, icon('back'), t.t('back')),
			search, list, detail);
	}

	/* ------------------------------------------------------------ messages */

	private queueRender(stick = false): void {
		if (this.renderQueued) return;
		this.renderQueued = true;
		requestAnimationFrame(() => {
			this.renderQueued = false;
			const atBottom = stick || this.atBottom();
			if (this.open && this.view === 'chat') this.renderAll();
			this.renderBadge();
			if (atBottom) this.scrollToBottom(false);
		});
	}

	private atBottom(): boolean {
		const s = this.el.scroller;
		return s.scrollHeight - s.scrollTop - s.clientHeight < 40;
	}

	private sorted(): Msg[] {
		return [...this.messages.values()].sort((a, b) => (a.cursor || Infinity) - (b.cursor || Infinity) || a.created_at.localeCompare(b.created_at));
	}

	private renderLog(): void {
		const log = this.el.log;
		clear(log);
		this.el.older.hidden = !this.hasOlder;
		const list = this.sorted();
		const intro: Msg[] = [];
		if (!list.length && (this.greeting || this.autoMessage)) {
			intro.push({ key: 'greet', cursor: 0, author: 'automation', author_name: '', body: this.autoMessage || this.greeting, created_at: new Date().toISOString() });
		}
		let lastDay = '';
		let prev: Msg | null = null;
		const all = [...intro, ...list];
		all.forEach((m, idx) => {
			const d = new Date(m.created_at);
			const day = d.toDateString();
			if (day !== lastDay) {
				log.appendChild(h('li', { class: 'tvx-day', role: 'separator' }, this.dayLabel(d)));
				lastDay = day; prev = null;
			}
			const mine = m.author === 'visitor';
			const next = all[idx + 1];
			const grouped = prev && prev.author === m.author && d.getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
			const lastOfGroup = !next || next.author !== m.author || new Date(next.created_at).getTime() - d.getTime() >= 5 * 60000 || new Date(next.created_at).toDateString() !== day;
			const bubble = h('div', { class: `tvx-bubble ${mine ? 'tvx-bubble--me' : 'tvx-bubble--them'}${m.author === 'automation' ? ' tvx-bubble--auto' : ''}` });
			if (m.author === 'automation') bubble.appendChild(h('span', { class: 'tvx-auto' }, m.author_name || this.t.t('automated')));
			if (m.body) bubble.appendChild(h('span', { class: 'tvx-text' }, ...linkify(m.body)));
			for (const a of m.attachments || []) bubble.appendChild(this.attachmentNode(a));
			const meta = lastOfGroup || m.failed || m.pending
				? h('div', { class: 'tvx-meta' },
					!mine && m.author === 'operator' && m.author_name ? h('span', {}, m.author_name + ' · ') : null,
					h('time', { datetime: m.created_at }, this.time(d)),
					mine ? h('span', { class: 'tvx-state' }, ' · ' + this.stateLabel(m)) : null,
					m.failed ? h('button', { type: 'button', class: 'tvx-link tvx-retry', onclick: () => this.retry(m) }, this.t.t('retry')) : null)
				: null;
			const li = h('li', { class: `tvx-msg ${mine ? 'tvx-msg--me' : 'tvx-msg--them'}${grouped ? ' tvx-msg--grouped' : ''}` },
				h('span', { class: 'tvx-sr' }, mine ? this.t.t('you') + ': ' : (m.author_name || (m.author === 'automation' ? this.t.t('automated') : this.t.t('team'))) + ': '),
				bubble, meta);
			log.appendChild(li);
			prev = m;
		});
		if (this.welcomeOptions.length && !list.some((m) => m.author === 'visitor')) {
			log.appendChild(h('li', { class: 'tvx-options' }, ...this.welcomeOptions.map((o) => h('button', { type: 'button', class: 'tvx-chip', onclick: () => this.chooseWelcome(o.index) }, o.label))));
		}
		if (this.conversation?.operator_typing) {
			log.appendChild(h('li', { class: 'tvx-msg tvx-msg--them' }, h('span', { class: 'tvx-typing', role: 'img', 'aria-label': this.t.t('typing') }, h('i', {}), h('i', {}), h('i', {}))));
		}
		if (this.conversation && !this.conversation.human_engaged && this.conversation.active && list.some((m) => m.author === 'visitor')) {
			const st = this.availability?.state;
			log.appendChild(h('li', { class: 'tvx-sys' }, st === 'online' ? this.t.t('queued') : st === 'away' ? this.cfg.texts.away : this.cfg.texts.offline));
		}
		if (this.ended && this.conversation) log.appendChild(this.endedBlock());
		if (!this.notifyAsked && this.cfg.appearance.notifications && 'Notification' in window && Notification.permission === 'default' && list.some((m) => m.author === 'visitor')) {
			log.appendChild(this.notifyPrompt());
		}
	}

	private attachmentNode(a: any): HTMLElement {
		if (a.kind === 'image') {
			return h('a', { class: 'tvx-att tvx-att--img', href: a.url, target: '_blank', rel: 'noopener' },
				h('img', { src: a.url + '?inline=1', alt: a.name || this.t.t('image'), loading: 'lazy', width: a.width || null, height: a.height || null }));
		}
		if (a.kind === 'voice') {
			return h('div', { class: 'tvx-att tvx-att--voice' }, h('audio', { controls: true, preload: 'none', src: a.url + '?inline=0', 'aria-label': this.t.t('voice') }));
		}
		return h('a', { class: 'tvx-att tvx-att--file', href: a.url, download: a.name },
			icon('file'), h('span', {}, a.name), h('span', { class: 'tvx-att__size' }, this.size(a.size)));
	}

	private stateLabel(m: Msg): string {
		if (m.failed) return this.t.t('failed');
		if (m.pending) return this.t.t('sending');
		return this.t.t(m.state === 'read' ? 'read' : m.state === 'delivered' ? 'delivered' : m.state === 'failed' ? 'failed' : 'sent');
	}

	private dayLabel(d: Date): string {
		const today = new Date();
		const y = new Date(); y.setDate(today.getDate() - 1);
		if (d.toDateString() === today.toDateString()) return this.t.t('today');
		if (d.toDateString() === y.toDateString()) return this.t.t('yesterday');
		try { return new Intl.DateTimeFormat(this.locale(), { dateStyle: 'medium' }).format(d); } catch { return d.toDateString(); }
	}

	private time(d: Date): string {
		try { return new Intl.DateTimeFormat(this.locale(), { hour: 'numeric', minute: '2-digit' }).format(d); } catch { return d.toLocaleTimeString(); }
	}

	private locale(): string { return String(this.cfg.locale || 'en').replace('_', '-'); }

	private size(n: number): string {
		if (n < 1024) return n + ' B';
		if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
		return (n / 1048576).toFixed(1) + ' MB';
	}

	private endedBlock(): HTMLElement {
		const t = this.t;
		const box = h('li', { class: 'tvx-ended' }, h('p', { class: 'tvx-sys' }, t.t('chat_ended')));
		if (this.cfg.csat.enabled && !this.rated) {
			let score = 0;
			const stars = h('div', { class: 'tvx-stars', role: 'radiogroup', 'aria-label': t.t('rate') },
				...[1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: 'tvx-star', role: 'radio', 'aria-checked': 'false', 'aria-label': t.t('rate_n', n), onclick: (e: Event) => {
					score = n;
					stars.querySelectorAll('button').forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === n)); b.classList.toggle('is-on', i < n); });
					(e.currentTarget as HTMLElement).focus();
				} }, icon('star'))));
			const comment = this.cfg.csat.comment ? h('textarea', { class: 'tvx-input-box', rows: '2', 'aria-label': t.t('rate_comment'), placeholder: t.t('rate_comment'), maxlength: '1000' }) : null;
			const submit = h('button', { type: 'button', class: 'tvx-btn-dark', onclick: async () => {
				if (!score) { (stars.querySelector('button') as HTMLElement).focus(); return; }
				try {
					await this.api.post(`conversations/${this.conversation.id}/rating`, { score, comment: comment ? (comment as HTMLTextAreaElement).value : '' });
					this.rated = true; this.announce(t.t('rate_thanks')); this.renderLog();
				} catch (e) { this.handleError(e); }
			} }, t.t('rate_submit'));
			box.appendChild(h('div', { class: 'tvx-rate' }, h('p', {}, t.t('rate')), stars, comment, submit));
		} else if (this.rated) {
			box.appendChild(h('p', { class: 'tvx-sys' }, t.t('rate_thanks')));
		}
		box.appendChild(h('div', { class: 'tvx-ended__actions' },
			h('button', { type: 'button', class: 'tvx-btn-dark', onclick: () => this.newConversation() }, t.t('new_chat')),
			this.cfg.transcript ? h('a', { class: 'tvx-link', href: this.cfg.rest + `conversations/${this.conversation.id}/transcript`, download: '' }, t.t('transcript')) : null));
		return box;
	}

	private notifyPrompt(): HTMLElement {
		const t = this.t;
		return h('li', { class: 'tvx-sys tvx-notifyask' }, h('span', {}, t.t('notify_ask')),
			h('button', { type: 'button', class: 'tvx-chip', onclick: async () => { this.notifyAsked = true; try { await Notification.requestPermission(); } catch { /* ignore */ } this.renderLog(); } }, t.t('notify_yes')),
			h('button', { type: 'button', class: 'tvx-link', onclick: () => { this.notifyAsked = true; this.renderLog(); } }, t.t('notify_no')));
	}

	private newConversation(): void {
		this.conversation = null;
		this.ended = false;
		this.rated = false;
		this.messages.clear();
		this.lastCursor = 0;
		this.welcomeOptions = [];
		this.poller?.setMode('idle');
		this.chooseView();
		this.renderAll();
		this.el.input.focus();
	}

	/* ------------------------------------------------------------- sending */

	private clientId(): string {
		const a = new Uint8Array(12);
		crypto.getRandomValues(a);
		return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	private pageContext(): Record<string, any> {
		const q = new URLSearchParams(location.search);
		return {
			page_path: location.pathname,
			page_title: document.title.slice(0, 120),
			referrer: document.referrer,
			utm: { source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' },
			locale: this.cfg.locale,
			device: this.device(),
			post_id: this.boot.page.page_id || 0,
		};
	}

	private async startConversation(extra: Record<string, any> = {}): Promise<void> {
		const res: any = await this.api.post('conversations', { ...extra, department: extra.department || this.department, context: this.pageContext() });
		this.setConversation(res.conversation);
		this.welcomeOptions = res.welcome?.options || [];
		await this.loadLatest();
		this.poller?.setMode(this.pollMode());
	}

	private async submit(): Promise<void> {
		const input = this.el.input as HTMLTextAreaElement;
		const body = input.value.trim();
		const ready = this.uploads.filter((u) => u.status === 'done');
		if (!body && !ready.length) return;
		if (this.uploads.some((u) => u.status === 'uploading')) return;
		input.value = '';
		this.autosize();
		this.clearDraft();
		const msg: Msg = { key: 'p' + Date.now(), cursor: 0, author: 'visitor', body, created_at: new Date().toISOString(), pending: true, client_id: this.clientId(), attIds: ready.map((u) => u.id!), attachments: ready.map((u) => ({ kind: 'file', name: u.name, size: u.file.size, url: '#' })) };
		this.messages.set(msg.key, msg);
		this.uploads = this.uploads.filter((u) => u.status !== 'done');
		this.typedThisSession = true;
		this.repliedThisSession = true;
		this.hideTeaser();
		this.updateSend();
		this.queueRender(true);
		await this.deliver(msg);
	}

	private async deliver(msg: Msg): Promise<void> {
		try {
			await this.ensureSession();
			if (!this.conversation || !this.conversation.active) {
				if (this.ended) this.newConversation();
				await this.startConversation();
			}
			const res: any = await this.api.post(`conversations/${this.conversation.id}/messages`, { body: msg.body, client_id: msg.client_id, attachments: msg.attIds || [] });
			this.messages.delete(msg.key);
			this.merge(res.message);
			this.conversation = res.conversation;
			this.poller?.setMode(this.pollMode());
			this.poller?.pokeOthers();
		} catch (e) {
			msg.pending = false;
			msg.failed = true;
			this.handleError(e);
		}
		this.queueRender(true);
	}

	private retry(m: Msg): void {
		m.failed = false;
		m.pending = true;
		this.queueRender();
		this.deliver(m);
	}

	private async chooseWelcome(index: number): Promise<void> {
		try {
			const res: any = await this.api.post(`conversations/${this.conversation.id}/welcome`, { option: index });
			for (const m of res.messages) this.merge(m);
			this.conversation = res.conversation;
			this.welcomeOptions = [];
			this.repliedThisSession = true;
			this.queueRender(true);
		} catch (e) { this.handleError(e); }
	}

	private onKey(e: KeyboardEvent): void {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			this.submit();
		}
	}

	private onInput(): void {
		this.autosize();
		this.updateSend();
		this.saveDraft();
		this.typedThisSession = true;
		this.hideTeaser();
		if (this.conversation?.active && Date.now() - this.typingSent > 3000) {
			this.typingSent = Date.now();
			this.api.post(`conversations/${this.conversation.id}/typing`).catch(() => undefined);
		}
	}

	private autosize(): void {
		const i = this.el.input as HTMLTextAreaElement;
		i.style.height = 'auto';
		i.style.height = Math.min(120, i.scrollHeight) + 'px';
	}

	private updateSend(): void {
		const has = (this.el.input as HTMLTextAreaElement).value.trim() !== '' || this.uploads.some((u) => u.status === 'done');
		(this.el.send as HTMLButtonElement).disabled = !has || this.uploads.some((u) => u.status === 'uploading');
	}

	private insertText(s: string): void {
		const i = this.el.input as HTMLTextAreaElement;
		const start = i.selectionStart ?? i.value.length;
		i.value = i.value.slice(0, start) + s + i.value.slice(i.selectionEnd ?? start);
		i.focus();
		i.selectionStart = i.selectionEnd = start + s.length;
		this.onInput();
	}

	private toggleEmoji(force?: boolean): void {
		const show = force ?? this.el.emoji.hidden;
		this.el.emoji.hidden = !show;
		this.el.emojiBtn.setAttribute('aria-expanded', String(show));
		if (show) (this.el.emoji.querySelector('button') as HTMLElement)?.focus();
	}

	/* -------------------------------------------------------------- drafts */

	private draftKey(): string { return 'draft:' + (this.conversation?.id || 'new'); }

	private saveDraft(): void {
		const v = (this.el.input as HTMLTextAreaElement).value;
		if (v) this.local.set(this.draftKey(), v, 24 * 36e5);
		else this.local.remove(this.draftKey());
	}

	private restoreDraft(): void {
		const v = this.local.get<string>(this.draftKey(), '');
		const i = this.el.input as HTMLTextAreaElement;
		if (v && !i.value) { i.value = v; this.autosize(); this.updateSend(); }
	}

	private clearDraft(): void { this.local.remove(this.draftKey()); }

	private onStorage(e: StorageEvent): void {
		const key = e.key ? Store.key(e.key) : null;
		if (key === this.draftKey() && this.root.activeElement !== this.el.input) {
			const i = this.el.input as HTMLTextAreaElement;
			try { i.value = e.newValue ? JSON.parse(e.newValue).v : ''; } catch { i.value = ''; }
			this.autosize(); this.updateSend();
		}
	}

	/* ------------------------------------------------------------- uploads */

	private onFiles(files: FileList | null): void {
		if (!files) return;
		for (const f of [...files].slice(0, 5)) this.addUpload(f, f.name);
		(this.el.file as HTMLInputElement).value = '';
	}

	private async addUpload(file: Blob, name: string): Promise<void> {
		const ext = name.split('.').pop()?.toLowerCase() || '';
		const u: Upload = { key: 'u' + Math.random().toString(36).slice(2), file, name, progress: 0, status: 'uploading' };
		if (!(this.cfg.uploads.accept || []).includes(ext === 'jpeg' ? 'jpg' : ext)) { u.status = 'error'; u.error = this.t.t('file_type'); }
		else if (file.size > this.cfg.uploads.max_mb * 1048576) { u.status = 'error'; u.error = this.t.t('file_too_large'); }
		if (file.type.startsWith('image/')) u.preview = URL.createObjectURL(file);
		this.uploads.push(u);
		this.renderUploads();
		if (u.status === 'error') return;
		this.startUpload(u);
	}

	private async startUpload(u: Upload): Promise<void> {
		u.status = 'uploading'; u.progress = 0; u.error = undefined;
		this.renderUploads(); this.updateSend();
		try {
			await this.ensureSession();
			if (!this.conversation || !this.conversation.active) await this.startConversation();
			const job = this.api.upload(`conversations/${this.conversation.id}/attachments`, u.file, u.name, (p) => { u.progress = p; this.renderUploadProgress(u); });
			u.abort = job.abort;
			const res = await job.promise;
			u.status = 'done'; u.id = res.attachment.id;
		} catch (e) {
			const err = e as ApiError;
			if (err.code === 'aborted') { this.uploads = this.uploads.filter((x) => x !== u); }
			else { u.status = 'error'; u.error = err.message || this.t.t('upload_failed'); }
		}
		this.renderUploads(); this.updateSend();
	}

	private renderUploadProgress(u: Upload): void {
		const bar = this.el.uploads.querySelector<HTMLElement>(`[data-k="${u.key}"] progress`);
		if (bar) (bar as HTMLProgressElement).value = Math.round(u.progress * 100);
	}

	private renderUploads(): void {
		const ul = this.el.uploads;
		clear(ul);
		ul.hidden = !this.uploads.length || this.view !== 'chat';
		for (const u of this.uploads) {
			ul.appendChild(h('li', { class: `tvx-up tvx-up--${u.status}`, 'data-k': u.key },
				u.preview ? h('img', { src: u.preview, alt: '' }) : icon('file'),
				h('span', { class: 'tvx-up__name' }, u.name),
				u.status === 'uploading' ? h('progress', { max: '100', value: String(Math.round(u.progress * 100)), 'aria-label': this.t.t('uploading') }) : null,
				u.status === 'error' ? h('span', { class: 'tvx-err', role: 'alert' }, u.error || '') : null,
				u.status === 'error' && !u.error?.includes('allowed') ? h('button', { type: 'button', class: 'tvx-link', onclick: () => this.startUpload(u) }, this.t.t('retry')) : null,
				h('button', { type: 'button', class: 'tvx-link', 'aria-label': (u.status === 'uploading' ? this.t.t('cancel') : this.t.t('remove')) + ' ' + u.name, onclick: () => {
					if (u.status === 'uploading') u.abort?.();
					this.uploads = this.uploads.filter((x) => x !== u);
					if (u.preview) URL.revokeObjectURL(u.preview);
					this.renderUploads(); this.updateSend();
				} }, u.status === 'uploading' ? this.t.t('cancel') : this.t.t('remove'))));
		}
	}

	/* --------------------------------------------------------------- voice */

	private voiceMime(): string {
		if (typeof MediaRecorder === 'undefined') return '';
		// Telegram voice notes accept OGG/Opus, MP3 or M4A; WebM is not offered.
		for (const m of ['audio/ogg;codecs=opus', 'audio/mp4']) if (MediaRecorder.isTypeSupported(m)) return m;
		return '';
	}

	private voiceSupported(): boolean {
		return !!this.cfg.uploads.voice && !!navigator.mediaDevices?.getUserMedia && this.voiceMime() !== '';
	}

	private async toggleRecord(): Promise<void> {
		if (this.recorder) { this.recorder.stop(); return; }
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			this.flash(this.t.t('mic_denied'));
			return;
		}
		const mime = this.voiceMime();
		const chunks: Blob[] = [];
		const rec = new MediaRecorder(stream, { mimeType: mime });
		this.recorder = rec;
		this.el.mic.classList.add('is-rec');
		this.el.mic.setAttribute('aria-label', this.t.t('stop_record'));
		clear(this.el.mic); this.el.mic.appendChild(icon('stop'));
		const limit = setTimeout(() => rec.state === 'recording' && rec.stop(), 120000);
		rec.ondataavailable = (e) => chunks.push(e.data);
		rec.onstop = () => {
			clearTimeout(limit);
			stream.getTracks().forEach((t) => t.stop());
			this.recorder = null;
			this.el.mic.classList.remove('is-rec');
			this.el.mic.setAttribute('aria-label', this.t.t('record'));
			clear(this.el.mic); this.el.mic.appendChild(icon('mic'));
			const blob = new Blob(chunks, { type: mime.split(';')[0] });
			if (blob.size) this.addUpload(blob, mime.startsWith('audio/ogg') ? 'voice.ogg' : 'voice.m4a');
		};
		rec.start();
	}

	/* ----------------------------------------------------- incoming/unread */

	private onIncoming(m: any, relayed: boolean): void {
		const visible = this.open && this.isVisible();
		if (!visible) {
			this.unread++;
			this.renderBadge();
			if (!this.open && m.author === 'operator' && !this.boot.preview) this.showTeaser(m.body || this.t.t('new_message'), 0, 'message');
		}
		if (!relayed && !visible) {
			this.ping();
			this.notify(m);
		}
		this.announce((m.author_name || this.t.t('team')) + ': ' + (m.body || this.t.t('file')));
	}

	private renderBadge(): void {
		const b = this.el.launcher.querySelector<HTMLElement>('.tvx-launcher__badge')!;
		b.hidden = this.unread <= 0;
		b.textContent = this.unread > 9 ? '9+' : String(this.unread);
		const base = this.cfg.appearance.variant === 'pill' ? this.cfg.texts.label : this.cfg.texts.label;
		const label = this.unread > 0 ? `${base}, ${this.t.n('unread', this.unread)}` : this.open ? this.t.t('close') : base;
		if (this.cfg.appearance.variant !== 'pill' || this.unread > 0 || this.open) this.el.launcher.setAttribute('aria-label', label);
		const n = this.el.latest.querySelector('.tvx-latest__n')!;
		n.textContent = this.unread > 0 ? this.t.n('unread', this.unread) : this.t.t('latest');
	}

	private ping(): void {
		if (!this.sound || !this.interacted) return;
		try {
			this.audio ||= new AudioContext();
			const ctx = this.audio, o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = 880; o.type = 'sine';
			g.gain.setValueAtTime(0.0001, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
			o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.3);
		} catch { /* autoplay restricted */ }
	}

	private notify(m: any): void {
		if (!this.cfg.appearance.notifications || !('Notification' in window) || Notification.permission !== 'granted' || this.isVisible()) return;
		try {
			const n = new Notification(this.t.t('notify_title', this.cfg.texts.title), { body: String(m.body || '').slice(0, 120), tag: 'televixo' });
			n.onclick = () => { window.focus(); this.openPanel(); n.close(); };
		} catch { /* ignore */ }
	}

	private announce(text: string): void {
		this.liveQueue.push(text.slice(0, 300));
		if (this.liveTimer) return;
		const next = () => {
			const t = this.liveQueue.shift();
			if (t === undefined) { this.liveTimer = 0; return; }
			this.el.live.textContent = t;
			this.liveTimer = window.setTimeout(next, 1500);
		};
		next();
	}

	private markReadSoon(): void {
		clearTimeout(this.readTimer);
		this.readTimer = window.setTimeout(() => {
			if (!this.conversation || !this.open || !this.isVisible() || !this.atBottom()) return;
			const read = this.conversation.visitor_read || 0;
			this.unread = 0;
			this.renderBadge();
			if (this.lastCursor > read) {
				this.conversation.visitor_read = this.lastCursor;
				this.api.post(`conversations/${this.conversation.id}/read`, { cursor: this.lastCursor }).catch(() => undefined);
			}
		}, 600);
	}

	private onScroll(): void {
		const bottom = this.atBottom();
		this.el.latest.hidden = bottom;
		if (bottom) this.markReadSoon();
	}

	private scrollToBottom(smooth: boolean): void {
		const s = this.el.scroller;
		s.scrollTo({ top: s.scrollHeight, behavior: smooth && !this.reducedMotion() ? 'smooth' : 'auto' });
		this.el.latest.hidden = true;
	}

	/* ---------------------------------------------------------------- menu */

	private toggleMenu(force?: boolean): void {
		const show = force ?? this.el.menu.hidden;
		this.renderMenu();
		this.el.menu.hidden = !show;
		this.el.moreBtn.setAttribute('aria-expanded', String(show));
		if (show) (this.el.menu.querySelector('button,a') as HTMLElement)?.focus();
	}

	private renderMenu(): void {
		const t = this.t;
		const m = this.el.menu;
		clear(m);
		const item = (label: string, fn: () => void, ic: string) => h('button', { type: 'button', role: 'menuitem', class: 'tvx-menu__item', onclick: () => { this.toggleMenu(false); fn(); } }, icon(ic), label);
		append(m, [
			item(this.sound ? t.t('sound_off') : t.t('sound_on'), () => { this.sound = !this.sound; this.local.set('sound', this.sound); this.interacted = true; }, this.sound ? 'mute' : 'sound'),
			this.cfg.kb_search ? item(t.t('help'), () => { this.view = 'kb'; this.renderAll(); this.focusFirst(); }, 'search') : null,
			this.conversation && this.cfg.transcript ? h('a', { role: 'menuitem', class: 'tvx-menu__item', href: this.cfg.rest + `conversations/${this.conversation.id}/transcript`, download: '' }, icon('file'), t.t('transcript')) : null,
			this.conversation?.active ? item(t.t('end_chat'), () => this.endChat(), 'x') : null,
			this.conversation ? item(t.t('report'), async () => { try { await this.api.post(`conversations/${this.conversation.id}/report`, { reason: 'visitor_report' }); this.flash(t.t('report_done')); } catch (e) { this.handleError(e); } }, 'bell') : null,
		]);
	}

	private async endChat(): Promise<void> {
		if (!window.confirm(this.t.t('end_confirm'))) return;
		try {
			const res: any = await this.api.post(`conversations/${this.conversation.id}/close`);
			this.conversation = res.conversation;
			this.ended = true;
			this.renderAll();
			this.scrollToBottom(false);
		} catch (e) { this.handleError(e); }
	}

	/* --------------------------------------------------------------- chips */

	private renderChips(): void {
		const c = this.el.chips;
		clear(c);
		const list: string[] = this.cfg.suggestions || [];
		const show = this.view === 'chat' && !this.ended && !this.sorted().some((m) => m.author === 'visitor');
		c.hidden = !show || (!list.length && !this.cfg.kb_search);
		if (!show) return;
		for (const s of list) c.appendChild(h('button', { type: 'button', class: 'tvx-chip', onclick: () => { (this.el.input as HTMLTextAreaElement).value = s; this.submit(); } }, s));
		if (this.cfg.kb_search) c.appendChild(h('button', { type: 'button', class: 'tvx-chip', onclick: () => { this.view = 'kb'; this.renderAll(); this.focusFirst(); } }, this.t.t('help')));
	}

	/* -------------------------------------------------------------- status */

	private renderStatus(): void {
		const st = this.availability?.state;
		const t = this.t;
		let label = this.cfg.texts.subtitle || '';
		let cls = 'unknown';
		if (st === 'online') { cls = 'online'; label = label || t.t('online'); }
		else if (st === 'away') { cls = 'away'; label = t.t('away'); }
		else if (st === 'closed') {
			cls = 'offline';
			label = this.availability.next_open ? t.t('opens_at', new Intl.DateTimeFormat(this.locale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(this.availability.next_open))) : t.t('closed_now');
		} else if (st === 'scheduled') { cls = 'scheduled'; label = label || t.t('scheduled'); }
		else if (st === 'offline') { cls = 'offline'; label = t.t('offline'); }
		this.el.statusDot.className = 'tvx-status__dot is-' + cls;
		this.el.statusText.textContent = label;
		const dot = this.el.launcher.querySelector<HTMLElement>('.tvx-launcher__dot')!;
		dot.hidden = st !== 'online';
		this.el.launcher.classList.toggle('is-offline', !!st && st !== 'online' && st !== 'scheduled');
		if (st && st !== 'online' && this.cfg.offline.behavior === 'hide' && !this.conversation?.active) this.setLauncherVisible(false, 'offline');
		else if (this.cfg.offline.behavior === 'hide') this.setLauncherVisible(this.launcherVisible, 'offline');
	}

	private setLauncherVisible(v: boolean, _why = 'rule'): void {
		const hide = !v || (this.cfg.offline.behavior === 'hide' && this.availability && this.availability.state !== 'online' && !this.conversation?.active);
		this.el.wrap.classList.toggle('tvx--hidden', hide && !this.open);
	}

	/* -------------------------------------------------------------- teaser */

	private showTeaser(text: string, rule: number, kind: string): void {
		if (this.open || !text) return;
		(this.el.teaser.querySelector('.tvx-teaser__text') as HTMLElement).textContent = text;
		this.el.teaser.hidden = false;
		this.el.teaser.dataset.rule = String(rule);
		this.el.teaser.dataset.kind = kind;
		this.el.wrap.classList.add('tvx--teasing');
		if (this.cfg.appearance.attention && !this.reducedMotion()) {
			this.el.launcher.classList.remove('tvx-attn');
			void this.el.launcher.offsetWidth;
			this.el.launcher.classList.add('tvx-attn');
		}
		this.announce(text);
	}

	private hideTeaser(): void {
		this.el.teaser.hidden = true;
		this.el.wrap.classList.remove('tvx--teasing');
	}

	private teaserClick(): void {
		const rule = Number(this.el.teaser.dataset.rule || 0);
		if (rule) this.trackRule(rule, 'teaser', 'clicked');
		this.openPanel();
	}

	private dismissTeaser(): void {
		const rule = Number(this.el.teaser.dataset.rule || 0);
		if (rule) this.trackRule(rule, 'teaser', 'dismissed');
		this.hideTeaser();
		this.dismissed = true;
		this.sess.set('dismissed', true);
		this.el.launcher.focus();
	}

	/* --------------------------------------------------------------- rules */

	private device(): string {
		const w = window.innerWidth;
		const coarse = window.matchMedia('(pointer: coarse)').matches;
		if (w < 640 || (coarse && w < 768)) return 'mobile';
		if (w < 1024 && coarse) return 'tablet';
		return w < 1024 ? 'tablet' : 'desktop';
	}

	private ruleContext(): Ctx {
		const q: Record<string, string> = {};
		new URLSearchParams(location.search).forEach((v, k) => { q[k] = v; });
		const seen = this.local.get<Record<string, number>>('seen', {});
		const ref = document.referrer ? (() => { try { const u = new URL(document.referrer); return u.host === location.host ? '' : u.host; } catch { return ''; } })() : '';
		return {
			...this.boot.page,
			path: location.pathname,
			query: q,
			device: this.device(),
			viewport_width: window.innerWidth,
			visitor_type: this.local.get('returning', false) ? 'returning' : 'new',
			referrer_host: this.sess.get('ref', ref),
			utm: { source: q.utm_source || this.sess.get('utm_source', ''), medium: q.utm_medium || '', campaign: q.utm_campaign || '' },
			business_hours: this.businessOpen() ? 'open' : 'closed',
			availability: this.availability?.state,
			logged_in: this.context.logged_in,
			roles: this.context.roles,
			cart_value: this.context.cart_total,
			cart_items: this.context.cart_items,
			conversation_state: !this.conversation ? 'none' : this.conversation.active ? 'active' : 'closed',
			chat_opened: this.open || this.sess.get('opened', false),
			seen,
			now: Math.floor(Date.now() / 1000),
			...(this.behavior ? this.behavior.snapshot() : {}),
		};
	}

	private businessOpen(): boolean {
		const hrs = this.cfg.hours;
		if (!hrs.enabled) return true;
		try {
			const parts = new Intl.DateTimeFormat('en-GB', { timeZone: hrs.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
			const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
			const date = `${get('year')}-${get('month')}-${get('day')}`;
			if ((hrs.holidays || []).includes(date)) return false;
			const day = get('weekday').toLowerCase().slice(0, 3);
			const hm = `${get('hour')}:${get('minute')}`;
			return (hrs.weekly[day] || []).some((r: string[]) => hm >= r[0] && hm < r[1]);
		} catch { return true; }
	}

	private evaluateRules(): void {
		const rules: Rule[] = this.cfg.rules || [];
		if (!rules.length || this.boot.preview) return;
		const ctx = this.ruleContext();
		const res = resolve(rules, ctx);
		const launcher = res.actions.launcher;
		this.launcherVisible = launcher ? launcher.visible !== false : true;
		this.setLauncherVisible(this.launcherVisible);
		if (res.actions.department?.key) this.department = res.actions.department.key;
		if (res.actions.greeting?.text) this.greeting = res.actions.greeting.text;
		const att = res.actions.attention;
		if (att && this.canAttention(att, rules.find((r) => r.id === att.rule)!)) this.fireAttention(att, rules.find((r) => r.id === att.rule)!);
	}

	/** Frequency caps, cooldowns, stop conditions and cross-tab suppression. */
	private canAttention(a: Action & { rule: number }, rule: Rule): boolean {
		if (!this.consent || this.attentionShown || this.open && a.type !== 'auto_message') return false;
		const stop = rule.definition.stop || {};
		if (stop.on_close !== false && this.dismissed) return false;
		if (stop.on_reply !== false && this.repliedThisSession) return false;
		if (stop.on_typing !== false && this.typedThisSession) return false;
		if (stop.on_human !== false && this.conversation?.human_engaged) return false;
		if (stop.if_opened !== false && this.sess.get('opened', false)) return false;
		const f = rule.definition.frequency || {};
		const hist = this.local.get<Record<string, number[]>>('exposures', {})[rule.id] || [];
		const sessCount = this.sess.get<Record<string, number>>('exposures', {})[rule.id] || 0;
		const now = Date.now();
		if (f.per_visitor && hist.length >= f.per_visitor) return false;
		if (f.per_session && sessCount >= f.per_session) return false;
		if (f.cooldown_hours && hist.length && now - hist[hist.length - 1] < f.cooldown_hours * 36e5) return false;
		const lock = this.local.get<number>('attention_lock', 0);
		if (now - lock < 15000) return false; // another tab just showed one
		return true;
	}

	private fireAttention(a: Action & { rule: number }, rule: Rule): void {
		this.attentionShown = true;
		const now = Date.now();
		this.local.set('attention_lock', now, 60000);
		const all = this.local.get<Record<string, number[]>>('exposures', {});
		all[rule.id] = [...(all[rule.id] || []), now].slice(-20);
		this.local.set('exposures', all, 400 * 864e5);
		const sess = this.sess.get<Record<string, number>>('exposures', {});
		sess[rule.id] = (sess[rule.id] || 0) + 1;
		this.sess.set('exposures', sess);
		const seen = this.local.get<Record<string, number>>('seen', {});
		seen[rule.id] = Math.floor(now / 1000);
		this.local.set('seen', seen, 400 * 864e5);
		if (a.type === 'teaser') this.showTeaser(a.text || this.greeting, rule.id, 'rule');
		else if (a.type === 'auto_message') { this.autoMessage = a.text || ''; this.showTeaser(a.text || '', rule.id, 'rule'); }
		else if (a.type === 'open_chat') this.openPanel('rule');
		this.trackRule(rule.id, a.type, 'shown');
		this.emit('trigger', { rule: rule.id, action: a.type });
	}

	private trackRule(rule: number, action: string, outcome: string): void {
		if (!this.sessionReady) return; // no session is created just for analytics
		this.api.post(`triggers/${rule}/events`, { action, outcome }).catch(() => undefined);
	}

	private watchNavigation(): void {
		const fire = () => window.dispatchEvent(new Event('televixo:navigate'));
		for (const fn of ['pushState', 'replaceState'] as const) {
			const orig = history[fn];
			history[fn] = function (this: History, ...args: any[]) { const r = orig.apply(this, args as any); fire(); return r; } as any;
		}
		window.addEventListener('popstate', fire);
		window.addEventListener('televixo:navigate', () => {
			if (location.pathname === this.path) return;
			this.path = location.pathname;
			this.behavior?.resetPage();
			this.attentionShown = false;
			if (this.excluded(this.path)) { this.close(); this.el.wrap.classList.add('tvx--hidden'); return; }
			this.el.wrap.classList.remove('tvx--hidden');
			this.evaluateRules();
		});
	}

	/* ---------------------------------------------------------- collisions */

	private watchCollisions(): void {
		const defaults = ['#place_order', '.wc-block-components-checkout-place-order-button', '.wc-block-cart__submit-container', '#CybotCookiebotDialog', '.cky-consent-container', '#cookie-notice', '.cmplz-cookiebanner', '.cc-window', '#moove_gdpr_cookie_info_bar'];
		const selectors = [...defaults, ...(this.cfg.appearance.avoid_selectors || [])];
		const run = () => {
			clearTimeout(this.avoidTimer);
			this.avoidTimer = window.setTimeout(() => this.avoid(selectors), 150);
		};
		window.addEventListener('resize', run, { passive: true });
		window.addEventListener('scroll', run, { passive: true });
		new MutationObserver(run).observe(document.body, { childList: true, subtree: false, attributes: false });
		run();
	}

	private avoid(selectors: string[]): void {
		const vh = window.innerHeight;
		const vw = window.innerWidth;
		const right = this.el.wrap.dataset.pos === 'right';
		const zoneW = 120;
		let lift = 0;
		for (const sel of selectors) {
			let nodes: NodeListOf<Element>;
			try { nodes = document.querySelectorAll(sel); } catch { continue; }
			nodes.forEach((n) => {
				const r = n.getBoundingClientRect();
				if (!r.width || !r.height || r.bottom <= 0 || r.top >= vh) return;
				const overlapsX = right ? r.right > vw - zoneW : r.left < zoneW;
				const nearBottom = r.top > vh * 0.45;
				if (overlapsX && nearBottom) lift = Math.max(lift, vh - r.top + 12);
			});
		}
		this.el.wrap.style.setProperty('--tvx-lift', Math.min(lift, vh * 0.5) + 'px');
	}

	/* ------------------------------------------------------------- preview */

	private previewContent(): void {
		const now = new Date();
		const ago = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
		this.availability = { state: 'online' };
		this.conversation = { id: 'preview', active: true, human_engaged: true, operator_typing: true, visitor_read: 3 };
		[
			{ cursor: 1, author: 'operator', author_name: 'Clara', body: this.greeting || 'Hi! How can we help you today?', created_at: ago(6) },
			{ cursor: 2, author: 'visitor', body: 'Which size am I?', created_at: ago(5), state: 'read' },
			{ cursor: 3, author: 'operator', author_name: 'Clara', body: 'Tell me your height and the size you usually wear.', created_at: ago(4) },
		].forEach((m: any) => this.messages.set('c' + m.cursor, { key: 'c' + m.cursor, ...m }));
		this.renderStatus();
		this.openPanel();
	}

	updatePreview(cfg: any): void {
		const wasOpen = this.open;
		this.cfg = cfg;
		this.greeting = cfg.texts.greeting || '';
		clear(this.el.wrap);
		this.el.wrap.remove();
		this.open = false;
		this.build(cfg.rtl ? 'rtl' : 'ltr');
		this.applyAppearance();
		this.renderStatus();
		if (wasOpen) this.openPanel();
	}

	/* ----------------------------------------------------------- public api */

	on(ev: string, fn: (d?: any) => void): void { (this.listeners[ev] ||= []).push(fn); }

	private emit(ev: string, d?: any): void {
		(this.listeners[ev] || []).forEach((f) => { try { f(d); } catch { /* ignore */ } });
		window.dispatchEvent(new CustomEvent('televixo:' + ev, { detail: d }));
	}

	setConsent(v: boolean): void {
		this.consent = v;
		this.local = new Store('local', v);
		this.sess = new Store('session', v);
		if (v) this.evaluateRules();
	}

	show(): void { this.launcherVisible = true; this.setLauncherVisible(true); }
	hide(): void { this.launcherVisible = false; this.close(); this.setLauncherVisible(false); }
	updatePage(ctx: Ctx): void { Object.assign(this.boot.page, ctx); this.evaluateRules(); }
}

function t(w: Widget, key: string): string {
	return (w as any).t.t(key);
}
