/**
 * Entry point. Reads window.televixoBoot (printed by Widget\Frontend) and
 * exposes a small public API on window.televixo.
 */
import { Boot, Widget } from './widget';

declare global {
	interface Window { televixoBoot?: Boot; televixo?: any; televixoConsent?: boolean; televixoPreview?: any }
}

function start(boot: Boot): Widget | null {
	try {
		const w = new Widget(boot);
		w.mount();
		return w;
	} catch (e) {
		// Never break the host page.
		if (window.console) console.error('[televixo]', e);
		return null;
	}
}

if (window.televixoBoot && !window.televixoBoot.preview) {
	const boot = window.televixoBoot;
	const go = () => {
		const w = start(boot);
		const queue: any[] = Array.isArray(window.televixo) ? window.televixo : [];
		window.televixo = {
			open: () => w?.openPanel(),
			close: () => w?.close(),
			toggle: () => w?.toggle(),
			show: () => w?.show(),
			hide: () => w?.hide(),
			setConsent: (v: boolean) => w?.setConsent(!!v),
			updatePage: (ctx: Record<string, unknown>) => w?.updatePage(ctx),
			on: (ev: string, fn: (d?: unknown) => void) => w?.on(ev, fn),
		};
		queue.forEach((cmd) => { if (Array.isArray(cmd) && typeof window.televixo[cmd[0]] === 'function') window.televixo[cmd[0]](...cmd.slice(1)); });
	};
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
	else go();
}

/** Admin live preview: mounts into a container without network access. */
window.televixoPreview = {
	mount(boot: Boot) {
		const w = start({ ...boot, preview: true });
		return { update: (cfg: unknown) => w?.updatePreview(cfg) };
	},
};
