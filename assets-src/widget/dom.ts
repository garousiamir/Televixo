/** Minimal DOM builder. Text is always set via textContent, never HTML. */
type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v === null || v === undefined || v === false) continue;
		if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
		else if (k === 'class') el.className = String(v);
		else el.setAttribute(k, v === true ? '' : String(v));
	}
	append(el, children);
	return el;
}

export function append(el: Element, children: (Child | Child[])[]): void {
	for (const c of children.flat()) {
		if (c === null || c === undefined || c === false) continue;
		el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
	}
}

export function clear(el: Element): void {
	while (el.firstChild) el.removeChild(el.firstChild);
}

/** Inline SVG icon from a fixed internal set (stroke = currentColor). */
const ICONS: Record<string, string> = {
	chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/>',
	discuss: '<path d="M3.5 11.5a7 7 0 1 1 3 5.75L3 18.5l1.2-3.3a7 7 0 0 1-.7-3.7z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>',
	help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6"/><path d="M12 17.2v.1"/>',
	mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
	x: '<path d="M6 6l12 12M18 6 6 18"/>',
	minus: '<path d="M6 12h12"/>',
	expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
	collapse: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
	clip: '<path d="M20 11.5 12.4 19a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/>',
	smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.1M15 9.5v.1"/>',
	mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
	stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
	more: '<circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/>',
	down: '<path d="M6 9.5l6 6 6-6"/>',
	arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>',
	back: '<path d="M14.5 6 8.5 12l6 6"/>',
	search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
	file: '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5"/>',
	star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/>',
	bell: '<path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 1.5H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
	sound: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.5 9a4 4 0 0 1 0 6M17.8 6.8a7 7 0 0 1 0 10.4"/>',
	mute: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
};

export function icon(name: string, custom?: string): HTMLSpanElement {
	const span = document.createElement('span');
	span.className = 'tvx-ico';
	span.setAttribute('aria-hidden', 'true');
	if (name === 'custom' && custom) {
		// Custom icon markup was sanitized server-side (SvgSanitizer allowlist).
		span.innerHTML = custom;
	} else {
		span.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${ICONS[name] || ICONS.chat}</svg>`;
	}
	return span;
}

/** Splits text into text and safe http(s) link nodes. */
export function linkify(text: string): Node[] {
	const out: Node[] = [];
	const re = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
		let href = m[0];
		try { href = new URL(href).href; } catch { out.push(document.createTextNode(m[0])); last = re.lastIndex; continue; }
		const a = document.createElement('a');
		a.href = href;
		a.textContent = m[0];
		a.target = '_blank';
		a.rel = 'noopener noreferrer nofollow ugc';
		out.push(a);
		last = re.lastIndex;
	}
	if (last < text.length) out.push(document.createTextNode(text.slice(last)));
	return out;
}
