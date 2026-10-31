/**
 * Adaptive polling with tab coordination.
 *
 * One tab (the leader, elected through a localStorage heartbeat) polls and
 * relays results to other tabs over BroadcastChannel. Without
 * BroadcastChannel or storage, every tab polls on its own.
 *
 * Intervals: panel open + visible 2.5s, slowing to 8s after a minute
 * without new messages; panel closed with an active conversation 15s;
 * hidden tab 30s. Errors back off exponentially (max 60s). `online`,
 * focus and visibility changes trigger an immediate poll.
 */
export type Mode = 'open' | 'closed' | 'idle';

export class Poller {
	private timer = 0;
	private mode: Mode = 'idle';
	private failures = 0;
	private lastNew = Date.now();
	private running = false;
	private channel: BroadcastChannel | null = null;
	private tabId = Math.random().toString(36).slice(2);
	private leaderTimer = 0;
	private static LEADER_KEY = 'televixo:v1:leader';

	constructor(private tick: () => Promise<boolean>, private onRelay: (data: any) => void, private onState: (s: 'ok' | 'error') => void) {
		if ('BroadcastChannel' in window) {
			this.channel = new BroadcastChannel('televixo');
			this.channel.onmessage = (e) => { if (e.data?.type === 'update') this.onRelay(e.data.payload); if (e.data?.type === 'poke') this.now(); };
		}
		document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.now(); else this.schedule(); });
		window.addEventListener('online', () => this.now());
		window.addEventListener('focus', () => this.now());
		this.leaderTimer = window.setInterval(() => this.heartbeat(), 4000);
		this.heartbeat();
	}

	private heartbeat() {
		try {
			const raw = localStorage.getItem(Poller.LEADER_KEY);
			const cur = raw ? JSON.parse(raw) : null;
			if (!cur || cur.id === this.tabId || Date.now() - cur.ts > 10000) {
				localStorage.setItem(Poller.LEADER_KEY, JSON.stringify({ id: this.tabId, ts: Date.now() }));
			}
		} catch { /* storage unavailable: every tab polls */ }
	}

	isLeader(): boolean {
		if (!this.channel) return true;
		try {
			const cur = JSON.parse(localStorage.getItem(Poller.LEADER_KEY) || 'null');
			return !cur || cur.id === this.tabId || Date.now() - cur.ts > 10000;
		} catch { return true; }
	}

	/** A tab with the panel open always polls itself for responsiveness. */
	private shouldPoll(): boolean {
		return this.mode !== 'idle' && (this.isLeader() || (this.mode === 'open' && document.visibilityState === 'visible'));
	}

	setMode(m: Mode) {
		const changed = m !== this.mode;
		this.mode = m;
		if (changed) { this.lastNew = Date.now(); this.now(); }
	}

	relay(payload: any) { this.channel?.postMessage({ type: 'update', payload }); }
	pokeOthers() { this.channel?.postMessage({ type: 'poke' }); }

	interval(): number {
		if (this.failures) return Math.min(60000, 2000 * 2 ** (this.failures - 1));
		if (document.visibilityState !== 'visible') return 30000;
		if (this.mode === 'closed') return 15000;
		return Date.now() - this.lastNew > 60000 ? 8000 : 2500;
	}

	now() {
		clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.run(), 0);
	}

	private schedule() {
		clearTimeout(this.timer);
		if (this.mode === 'idle') return;
		this.timer = window.setTimeout(() => this.run(), this.interval());
	}

	private async run() {
		if (this.running) return;
		if (!this.shouldPoll()) { this.schedule(); return; }
		this.running = true;
		try {
			const gotNew = await this.tick();
			if (gotNew) this.lastNew = Date.now();
			if (this.failures) this.onState('ok');
			this.failures = 0;
		} catch {
			this.failures++;
			this.onState('error');
		} finally {
			this.running = false;
			this.schedule();
		}
	}

	stop() { clearTimeout(this.timer); clearInterval(this.leaderTimer); this.mode = 'idle'; }
}
