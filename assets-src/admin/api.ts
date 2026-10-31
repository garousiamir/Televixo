import apiFetch from '@wordpress/api-fetch';

declare global {
	interface Window { televixoAdmin: any; televixoPreview?: any }
}

export const cfg = window.televixoAdmin || {};
export const can = (cap: string) => (cfg.caps || []).includes(cap);

export interface ApiErr { code: string; message: string; data?: any }

export async function api<T = any>(path: string, method = 'GET', data?: any): Promise<T> {
	return apiFetch<T>({ path: '/televixo/v1/' + path.replace(/^\//, ''), method, data });
}

export function errText(e: unknown): string {
	const err = e as ApiErr;
	return err?.message || String(e);
}

export function fmtDate(iso?: string | null, withTime = true): string {
	if (!iso) return '—';
	try {
		return new Intl.DateTimeFormat((cfg.locale || 'en').replace('_', '-'), withTime ? { dateStyle: 'medium', timeStyle: 'short', timeZone: cfg.timezone || undefined } : { dateStyle: 'medium', timeZone: cfg.timezone || undefined }).format(new Date(iso));
	} catch {
		return iso;
	}
}

export function fmtDuration(s?: number | null): string {
	if (s === null || s === undefined) return '—';
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.round(s / 60)}m`;
	return `${(s / 3600).toFixed(1)}h`;
}
