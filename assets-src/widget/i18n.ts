/**
 * Translations delivered by PHP (Widget\Strings). Plural forms are chosen by
 * evaluating the locale's gettext Plural-Forms expression with a small
 * recursive-descent parser (no eval / new Function).
 */
export interface I18nData {
	s: Record<string, string>;
	p: Record<string, string[]>;
	plural: string;
}

type Tok = { t: 'n' | 'num' | 'op' | '(' | ')' | '?' | ':'; v?: string };

function tokenize(src: string): Tok[] {
	const out: Tok[] = [];
	const re = /\s*(?:(n)|(\d+)|(\|\||&&|==|!=|<=|>=|[<>%!+\-*/])|([()?:]))/y;
	let m: RegExpExecArray | null;
	while (re.lastIndex < src.length && (m = re.exec(src))) {
		if (m[1]) out.push({ t: 'n' });
		else if (m[2]) out.push({ t: 'num', v: m[2] });
		else if (m[3]) out.push({ t: 'op', v: m[3] });
		else out.push({ t: m[4] as Tok['t'] });
	}
	return out;
}

/** Compiles a plural expression into a function; falls back to `n != 1`. */
export function compilePlural(expr: string): (n: number) => number {
	try {
		const toks = tokenize(expr);
		let i = 0;
		const peek = () => toks[i];
		const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
		type F = (n: number) => number;
		const primary = (): F => {
			const t = toks[i++];
			if (!t) throw new Error('eof');
			if (t.t === 'n') return (n) => n;
			if (t.t === 'num') { const v = Number(t.v); return () => v; }
			if (t.t === 'op' && t.v === '!') { const a = primary(); return (n) => (a(n) ? 0 : 1); }
			if (t.t === '(') { const e = ternary(); if (toks[i++]?.t !== ')') throw new Error(')'); return e; }
			throw new Error('unexpected');
		};
		const binary = (min: number): F => {
			let left = primary();
			for (;;) {
				const t = peek();
				if (!t || t.t !== 'op' || PREC[t.v!] === undefined || PREC[t.v!] < min) return left;
				i++;
				const op = t.v!, right = binary(PREC[op] + 1), l = left;
				left = (n) => {
					const a = l(n), b = right(n);
					switch (op) {
						case '||': return a || b ? 1 : 0; case '&&': return a && b ? 1 : 0;
						case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
						case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0;
						case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
						case '+': return a + b; case '-': return a - b; case '*': return a * b;
						case '/': return b ? Math.floor(a / b) : 0; default: return b ? a % b : 0;
					}
				};
			}
		};
		const ternary = (): F => {
			const cond = binary(1);
			if (peek()?.t !== '?') return cond;
			i++;
			const a = ternary();
			if (toks[i++]?.t !== ':') throw new Error(':');
			const b = ternary();
			return (n) => (cond(n) ? a(n) : b(n));
		};
		const fn = ternary();
		if (i !== toks.length) throw new Error('trailing');
		return (n) => Number(fn(n)) || 0;
	} catch {
		return (n) => (n !== 1 ? 1 : 0);
	}
}

export class I18n {
	private plural: (n: number) => number;
	constructor(private data: I18nData) {
		this.plural = compilePlural(data.plural || 'n != 1');
	}
	t(key: string, ...args: (string | number)[]): string {
		let s = this.data.s[key] ?? key;
		for (const a of args) s = s.replace(/%(?:\d\$)?[sd]/, String(a));
		return s;
	}
	n(key: string, count: number): string {
		const forms = this.data.p[key] || [key, key];
		const idx = Math.min(this.plural(count), forms.length - 1);
		return (forms[idx] || forms[0]).replace(/%d/, String(count));
	}
}
