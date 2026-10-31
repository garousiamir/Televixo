/**
 * First-party browser storage with a fixed prefix, expiry and graceful
 * failure (private mode, disabled storage). Used for: returning-visitor
 * flag, trigger exposure history, drafts, sound preference and the
 * "has session" hint. Never stores credentials.
 */
const PREFIX = 'televixo:v1:';

function backend(kind: 'local' | 'session'): Storage | null {
	try {
		const s = kind === 'local' ? window.localStorage : window.sessionStorage;
		const k = PREFIX + '__t';
		s.setItem(k, '1');
		s.removeItem(k);
		return s;
	} catch {
		return null;
	}
}

const memory = new Map<string, string>();

export class Store {
	private s: Storage | null;
	constructor(kind: 'local' | 'session', private enabled = true) {
		this.s = enabled ? backend(kind) : null;
	}
	get available(): boolean { return this.s !== null; }
	get<T>(key: string, fallback: T): T {
		try {
			const raw = this.s ? this.s.getItem(PREFIX + key) : memory.get(PREFIX + key) ?? null;
			if (!raw) return fallback;
			const v = JSON.parse(raw) as { v: T; e?: number };
			if (v.e && v.e < Date.now()) { this.remove(key); return fallback; }
			return v.v;
		} catch {
			return fallback;
		}
	}
	set<T>(key: string, value: T, ttlMs?: number): void {
		const raw = JSON.stringify({ v: value, e: ttlMs ? Date.now() + ttlMs : undefined });
		try {
			if (this.s) this.s.setItem(PREFIX + key, raw);
			else memory.set(PREFIX + key, raw);
		} catch { /* quota or disabled: keep working without persistence */ }
	}
	remove(key: string): void {
		try { this.s?.removeItem(PREFIX + key); } catch { /* ignore */ }
		memory.delete(PREFIX + key);
	}
	static key(raw: string): string | null {
		return raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : null;
	}
}
