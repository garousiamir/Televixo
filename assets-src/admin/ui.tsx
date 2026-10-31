import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

let uid = 0;
export const useId = (p = 'tvx') => useRef(`${p}-${++uid}`).current;

export function Button({ variant = 'dark', children, ...rest }: any) {
	return <button type="button" className={`tvxa-btn tvxa-btn--${variant}`} {...rest}>{children}</button>;
}

export function Card({ title, children, actions, description }: any) {
	return (
		<section className="tvxa-card">
			{(title || actions) && <header className="tvxa-card__head">{title && <h2>{title}</h2>}{actions && <div className="tvxa-card__actions">{actions}</div>}</header>}
			{description && <p className="tvxa-muted">{description}</p>}
			{children}
		</section>
	);
}

export function Notice({ kind = 'info', children, onDismiss }: any) {
	return (
		<div className={`tvxa-notice tvxa-notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
			<div>{children}</div>
			{onDismiss && <button type="button" className="tvxa-link" onClick={onDismiss}>{__('Dismiss', 'televixo')}</button>}
		</div>
	);
}

export function Field({ label, help, children, id }: any) {
	return (
		<div className="tvxa-field">
			<label htmlFor={id}>{label}</label>
			{children}
			{help && <p className="tvxa-help" id={id ? id + '-help' : undefined}>{help}</p>}
		</div>
	);
}

export function Text({ label, value, onChange, help, type = 'text', multiline = false, ...rest }: any) {
	const id = useId('f');
	return (
		<Field label={label} help={help} id={id}>
			{multiline
				? <textarea id={id} className="tvxa-input" value={value ?? ''} onChange={(e: any) => onChange(e.target.value)} rows={rest.rows || 3} aria-describedby={help ? id + '-help' : undefined} {...rest} />
				: <input id={id} className="tvxa-input" type={type} value={value ?? ''} onChange={(e: any) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} aria-describedby={help ? id + '-help' : undefined} {...rest} />}
		</Field>
	);
}

export function Select({ label, value, onChange, options, help, ...rest }: any) {
	const id = useId('s');
	return (
		<Field label={label} help={help} id={id}>
			<select id={id} className="tvxa-input" value={value ?? ''} onChange={(e: any) => onChange(e.target.value)} {...rest}>
				{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
			</select>
		</Field>
	);
}

export function Toggle({ label, checked, onChange, help }: any) {
	const id = useId('t');
	return (
		<div className="tvxa-toggle">
			<input id={id} type="checkbox" role="switch" checked={!!checked} onChange={(e: any) => onChange(e.target.checked)} aria-describedby={help ? id + '-help' : undefined} />
			<label htmlFor={id}>{label}</label>
			{help && <p className="tvxa-help" id={id + '-help'}>{help}</p>}
		</div>
	);
}

export function Badge({ children, tone = 'neutral' }: any) {
	return <span className={`tvxa-badge tvxa-badge--${tone}`}>{children}</span>;
}

export function Tabs({ tabs, active, onChange, label }: any) {
	return (
		<div className="tvxa-tabs" role="tablist" aria-label={label}>
			{tabs.map((t: any) => (
				<button key={t.id} type="button" role="tab" aria-selected={active === t.id} className="tvxa-tab" onClick={() => onChange(t.id)}>
					{t.label}{t.count ? <span className="tvxa-tab__count">{t.count}</span> : null}
				</button>
			))}
		</div>
	);
}

export function usePoll(fn: () => void, ms: number, deps: any[] = []) {
	useEffect(() => {
		fn();
		let t = window.setInterval(() => { if (document.visibilityState === 'visible') fn(); }, ms);
		return () => clearInterval(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);
}

/** Simple saved-state helper for settings-like screens. */
export function useSaver() {
	const [state, setState] = useState<{ kind: string; text: string } | null>(null);
	return {
		notice: state ? <Notice kind={state.kind} onDismiss={() => setState(null)}>{state.text}</Notice> : null,
		ok: (text: string) => setState({ kind: 'success', text }),
		fail: (text: string) => setState({ kind: 'error', text }),
		clear: () => setState(null),
	};
}

export function Empty({ children }: any) {
	return <p className="tvxa-empty">{children}</p>;
}

export function Copy({ text }: { text: string }) {
	const [done, setDone] = useState(false);
	return <Button variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}>{done ? __('Copied', 'televixo') : __('Copy', 'televixo')}</Button>;
}
