/**
 * Browser rule evaluation. Mirrors televixo/includes/Rules/Engine.php; both
 * run tests/fixtures/rule-vectors.json. Keep the two in sync.
 */
export interface Condition { type: string; operator: string; value: any }
export interface Group { op: 'and' | 'or'; negate?: boolean; items: (Condition | Group)[] }
export interface Action { type: string; text?: string; visible?: boolean; key?: string }
export interface RuleDef {
	conditions: Group;
	exclusions?: Group | null;
	actions: Action[];
	frequency?: { per_page?: number | null; per_session?: number | null; per_visitor?: number | null; cooldown_hours?: number | null; expires_at?: string | null };
	stop?: { on_reply?: boolean; on_typing?: boolean; on_close?: boolean; on_human?: boolean; if_opened?: boolean };
}
export interface Rule { id: number; priority: number; definition: RuleDef }
export type Ctx = Record<string, any>;
export interface TraceEntry { path: string; type?: string; result: boolean }

const isGroup = (x: Condition | Group): x is Group => Array.isArray((x as Group).items);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const lower = (v: unknown) => String(v ?? '').toLowerCase();

export function normalizePath(p: string): string {
	let path = p;
	try { path = new URL(p, 'https://x.invalid').pathname; } catch { /* keep */ }
	try { path = decodeURIComponent(path); } catch { /* keep raw */ }
	path = '/' + path.toLowerCase().replace(/^\/+/, '');
	return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function wildcard(pattern: string, path: string): boolean {
	const parts = normalizePath(pattern).split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp('^' + parts.join('.*') + '$').test(normalizePath(path));
}

const inOp = (op: string, hit: boolean) => (op === 'not_in' ? !hit : hit);
const intersects = (a: unknown, b: unknown) => { const B = arr(b).map(String); return arr(a).some((x) => B.includes(String(x))); };

export function test(c: Condition, ctx: Ctx, ruleId = 0): boolean {
	const { operator: op, value: v } = c;
	switch (c.type) {
		case 'site': return true;
		case 'page_id': return inOp(op, arr(v).map(Number).includes(Number(ctx.page_id || 0)));
		case 'woo_product': return inOp(op, arr(v).map(Number).includes(Number(ctx.product_id || 0)));
		case 'woo_category': return inOp(op, arr(ctx.product_cats).map(Number).some((x) => arr(v).map(Number).includes(x)));
		case 'post_type': return inOp(op, intersects(ctx.post_type, v));
		case 'template': return inOp(op, intersects(ctx.template, v));
		case 'language': return inOp(op, intersects(ctx.language, v));
		case 'woo_page': return inOp(op, intersects(ctx.woo_page, v));
		case 'page_kind': return inOp(op, intersects(ctx.page_kinds, v));
		case 'term': return inOp(op, intersects(ctx.terms, v));
		case 'role': return inOp(op, intersects(ctx.roles, v));
		case 'url': {
			const path = normalizePath(String(ctx.path ?? '/'));
			if (op === 'equals') return path === normalizePath(String(v));
			if (op === 'contains') return v !== '' && path.includes(lower(v));
			if (op === 'wildcard') return wildcard(String(v), path);
			if (op === 'not_wildcard') return !wildcard(String(v), path);
			return false;
		}
		case 'query': {
			const q = ctx.query || {};
			const has = Object.prototype.hasOwnProperty.call(q, v.key);
			if (op === 'exists') return has;
			if (op === 'not_exists') return !has;
			return has && String(q[v.key]) === String(v.value);
		}
		case 'logged_in': case 'exit_intent': case 'chat_opened':
			return Boolean(ctx[c.type]) === Boolean(v);
		case 'device': case 'availability': case 'conversation_state':
			return arr(v).includes(String(ctx[c.type] ?? ''));
		case 'visitor_type': case 'business_hours':
			return String(ctx[c.type] ?? '') === String(v);
		case 'viewport_width': case 'cart_value': case 'cart_items': case 'time_on_page': case 'scroll_depth': case 'inactivity': {
			if (ctx[c.type] === undefined || ctx[c.type] === null) return false;
			const n = Number(ctx[c.type]);
			return op === 'lte' ? n <= Number(v) : n >= Number(v);
		}
		case 'referrer_host': {
			const host = lower(ctx.referrer_host);
			if (op === 'empty') return host === '';
			if (op === 'equals') return host === lower(v);
			return v !== '' && host.includes(lower(v));
		}
		case 'utm_source': case 'utm_medium': case 'utm_campaign': {
			const actual = lower((ctx.utm || {})[c.type.slice(4)]);
			return op === 'equals' ? actual === lower(v) : v !== '' && actual.includes(lower(v));
		}
		case 'trigger_seen': {
			const rule = v.rule || ruleId;
			const last = Number((ctx.seen || {})[String(rule)] || 0);
			const now = Number(ctx.now ?? Math.floor(Date.now() / 1000));
			const seen = last > 0 && now - last < v.hours * 3600;
			return op === 'within_hours' ? seen : !seen;
		}
	}
	return false;
}

function group(g: Group, ctx: Ctx, ruleId: number, trace: TraceEntry[], path: string): boolean {
	const results = g.items.map((item, i) => (isGroup(item) ? group(item, ctx, ruleId, trace, `${path}.${i}`) : cond(item, ctx, ruleId, trace, `${path}.${i}`)));
	let v = g.op === 'or' ? results.includes(true) : !results.includes(false);
	if (g.negate) v = !v;
	trace.push({ path, result: v });
	return v;
}

function cond(c: Condition, ctx: Ctx, ruleId: number, trace: TraceEntry[], path: string): boolean {
	const r = test(c, ctx, ruleId);
	trace.push({ path, type: c.type, result: r });
	return r;
}

export function evaluate(def: RuleDef, ctx: Ctx, ruleId = 0): { matched: boolean; trace: TraceEntry[] } {
	const trace: TraceEntry[] = [];
	const today = ctx.today ?? new Date().toISOString().slice(0, 10);
	if (def.frequency?.expires_at && today > def.frequency.expires_at) return { matched: false, trace };
	if (def.exclusions && def.exclusions.items?.length && group(def.exclusions, ctx, ruleId, trace, 'exclusions')) return { matched: false, trace };
	return { matched: group(def.conditions, ctx, ruleId, trace, 'conditions'), trace };
}

export interface Resolved { actions: Record<string, Action & { rule: number; priority: number }>; matched: number[] }

/** Same precedence as Engine::resolve(). */
export function resolve(rules: Rule[], ctx: Ctx): Resolved {
	const sorted = [...rules].sort((a, b) => b.priority - a.priority || a.id - b.id);
	const actions: Resolved['actions'] = {};
	const matched: number[] = [];
	for (const rule of sorted) {
		if (!evaluate(rule.definition, ctx, rule.id).matched) continue;
		matched.push(rule.id);
		for (const a of rule.definition.actions) {
			const slot = ['teaser', 'open_chat', 'auto_message'].includes(a.type) ? 'attention' : a.type;
			const entry = { ...a, rule: rule.id, priority: rule.priority };
			if (!actions[slot]) actions[slot] = entry;
			else if (slot === 'launcher' && actions[slot].priority === rule.priority && a.visible === false) actions[slot] = entry;
		}
	}
	return { actions, matched };
}

/** Which kinds of signals a rule set needs (to avoid needless work/requests). */
export function needs(rules: Rule[]): { session: boolean; behavior: boolean } {
	const SESSION = ['logged_in', 'role', 'cart_value', 'cart_items', 'availability', 'conversation_state'];
	const BEHAVIOR = ['time_on_page', 'scroll_depth', 'inactivity', 'exit_intent'];
	let session = false, behavior = false;
	const walk = (g?: Group | null) => g?.items.forEach((i) => (isGroup(i) ? walk(i) : (session ||= SESSION.includes(i.type), behavior ||= BEHAVIOR.includes(i.type))));
	rules.forEach((r) => { walk(r.definition.conditions); walk(r.definition.exclusions); });
	return { session, behavior };
}
