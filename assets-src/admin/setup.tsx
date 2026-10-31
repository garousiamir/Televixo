import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, cfg, errText, fmtDate } from './api';
import { Badge, Button, Card, Copy, Notice, Select, Text } from './ui';

export function Setup() {
	const [status, setStatus] = useState<any>(null);
	const [token, setToken] = useState('');
	const [chat, setChat] = useState('');
	const [mode, setMode] = useState('reply');
	const [checks, setChecks] = useState<any[] | null>(null);
	const [detected, setDetected] = useState<any[]>([]);
	const [webhook, setWebhook] = useState<any>(null);
	const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [challenge, setChallenge] = useState<any>(null);

	const load = async () => {
		const s = await api('admin/telegram/status');
		setStatus(s);
		setChat(s.destination.chat_id || '');
		setMode(s.routing_mode || 'reply');
		if (s.token_set) {
			api('admin/telegram/webhook').then(setWebhook).catch(() => setWebhook(null));
			api('admin/telegram/detected-chats').then((r) => setDetected(r.items)).catch(() => undefined);
		}
	};
	useEffect(() => { load().catch((e) => setMsg({ kind: 'error', text: errText(e) })); }, []);

	const run = async (fn: () => Promise<void>) => {
		setBusy(true); setMsg(null);
		try { await fn(); } catch (e: any) { setMsg({ kind: 'error', text: errText(e) }); } finally { setBusy(false); }
	};

	const saveToken = (confirm = false) => run(async () => {
		try {
			const r = await api('admin/telegram/token', 'POST', { token, confirm_bot_change: confirm });
			setToken('');
			setMsg({ kind: 'success', text: sprintf(__('Connected to @%s.', 'televixo'), r.bot.username) });
			await load();
		} catch (e: any) {
			if (e.code === 'bot_change_confirm' && window.confirm(e.message)) return saveToken(true);
			throw e;
		}
	});

	const saveDestination = (anyway = false) => run(async () => {
		const r = await api('admin/telegram/destination', 'POST', { chat_id: chat, mode, save_anyway: anyway });
		setChecks(r.checks);
		setMsg(r.saved ? { kind: 'success', text: r.note } : { kind: 'warning', text: __('Some checks failed. Fix them in Telegram and check again, or save anyway.', 'televixo') });
		if (r.saved) await load();
	});

	const registerWebhook = (confirm = false) => run(async () => {
		try {
			setWebhook(await api('admin/telegram/webhook', 'POST', { confirm_replace: confirm }));
			setMsg({ kind: 'success', text: __('Webhook registered. Telegram will now deliver operator replies to this site.', 'televixo') });
		} catch (e: any) {
			if (e.code === 'webhook_in_use' && window.confirm(e.message)) return registerWebhook(true);
			throw e;
		}
	});

	if (!status) return <p>{__('Loading…', 'televixo')}</p>;
	return (
		<div className="tvxa-stack">
			{msg && <Notice kind={msg.kind} onDismiss={() => setMsg(null)}>{msg.text}</Notice>}
			<Card title={__('1. Connect your bot', 'televixo')} description={__('Create a bot with @BotFather in Telegram, then paste its token. Use a dedicated bot for this website: a bot can only send updates to one webhook.', 'televixo')}>
				{status.token_set
					? <p><Badge tone="ok">{__('Connected', 'televixo')}</Badge> @{status.bot.username} ({status.bot.id}) {status.token_from_config && <Badge>{__('Token set in wp-config.php', 'televixo')}</Badge>}</p>
					: <p><Badge tone="warn">{__('Not connected', 'televixo')}</Badge></p>}
				{!status.token_from_config && <div className="tvxa-row">
					<Text label={__('Bot token', 'televixo')} type="password" autoComplete="off" value={token} onChange={setToken} help={__('Stored encrypted. It is never shown again or sent to the browser.', 'televixo')} />
					<Button disabled={busy || !token} onClick={() => saveToken()}>{status.token_set ? __('Replace token', 'televixo') : __('Test & save', 'televixo')}</Button>
				</div>}
			</Card>

			<Card title={__('2. Choose where chats appear', 'televixo')} description={__('Add the bot to a Telegram group for your team (or use a private chat with one operator). Then send any message in that group so it appears below, or enter its chat ID.', 'televixo')}>
				<Notice kind="warning">{__('Everyone in the chosen group can read the visitor messages relayed there. If teams must not see each other’s chats, use a separate group per team (Operators & teams) or answer only in the WordPress inbox.', 'televixo')}</Notice>
				{detected.length > 0 && <div className="tvxa-detected"><p className="tvxa-label">{__('Chats the bot has seen recently', 'televixo')}</p>{detected.map((d) => <Button key={d.id} variant="ghost" onClick={() => setChat(d.id)}>{d.title || d.id} · {d.type}{d.is_forum ? ' · ' + __('topics', 'televixo') : ''}</Button>)}</div>}
				<div className="tvxa-grid2">
					<Text label={__('Chat ID', 'televixo')} value={chat} onChange={setChat} help={__('Group IDs start with -100.', 'televixo')} />
					<Select label={__('Routing mode for new conversations', 'televixo')} value={mode} onChange={setMode} options={[
						{ value: 'reply', label: __('Reply Mode – operators reply to the bot’s message', 'televixo') },
						{ value: 'topics', label: __('Topics Mode – one forum topic per conversation', 'televixo') },
					]} help={__('Existing conversations keep the mode they started with.', 'televixo')} />
				</div>
				<p className="tvxa-help">{mode === 'reply'
					? __('Reply Mode works with privacy mode on: the bot receives replies to its own messages. Operators must use Telegram’s Reply on a visitor message; plain group messages are ignored.', 'televixo')
					: __('Topics Mode needs a supergroup with Topics enabled and the bot as administrator with “Manage topics”. Every message an enrolled operator writes inside a conversation topic is sent to the visitor, except lines starting with the note prefix.', 'televixo')}</p>
				<Button disabled={busy || !status.token_set || !chat} onClick={() => saveDestination()}>{__('Check & save', 'televixo')}</Button>
				{checks && <ul className="tvxa-checks">{checks.map((c) => <li key={c.id}><Badge tone={c.ok ? 'ok' : 'bad'}>{c.ok ? __('OK', 'televixo') : __('Action needed', 'televixo')}</Badge> {c.message}</li>)}</ul>}
				{checks && checks.some((c) => !c.ok) && <Button variant="ghost" onClick={() => saveDestination(true)}>{__('Save anyway', 'televixo')}</Button>}
				{status.destination.chat_id && <p className="tvxa-muted">{sprintf(__('Current destination: %1$s (%2$s)', 'televixo'), status.destination.title || status.destination.chat_id, status.destination.type)}</p>}
			</Card>

			<Card title={__('3. Receive replies (webhook)', 'televixo')} description={__('Telegram sends operator replies to this address. HTTPS is required.', 'televixo')}>
				<p><code>{cfg.webhookUrl}</code> <Copy text={cfg.webhookUrl} /></p>
				{!status.https && <Notice kind="error">{__('This site is not served over HTTPS, so Telegram cannot deliver webhooks.', 'televixo')}</Notice>}
				{webhook && <ul className="tvxa-checks">
					<li><Badge tone={webhook.ours ? 'ok' : webhook.registered ? 'warn' : 'bad'}>{webhook.ours ? __('Registered to this site', 'televixo') : webhook.registered ? sprintf(__('Registered to another host: %s', 'televixo'), webhook.other_host) : __('Not registered', 'televixo')}</Badge></li>
					{webhook.pending > 0 && <li>{sprintf(__('%d updates waiting at Telegram', 'televixo'), webhook.pending)}</li>}
					{webhook.last_error && <li><Badge tone="bad">{__('Last error', 'televixo')}</Badge> {webhook.last_error} ({fmtDate(webhook.last_error_date)})</li>}
					<li>{__('Last update received:', 'televixo')} {fmtDate(status.webhook_last_seen)}</li>
				</ul>}
				<div className="tvxa-row">
					<Button disabled={busy || !status.token_set || !status.https} onClick={() => registerWebhook()}>{__('Register webhook', 'televixo')}</Button>
					{webhook?.ours && <Button variant="ghost" disabled={busy} onClick={() => run(async () => { await api('admin/telegram/webhook', 'DELETE'); setWebhook(await api('admin/telegram/webhook')); })}>{__('Remove webhook', 'televixo')}</Button>}
					<Button variant="ghost" disabled={busy || !status.destination.chat_id} onClick={() => run(async () => { const r = await api('admin/telegram/test-message', 'POST'); setMsg({ kind: 'success', text: r.note }); })}>{__('Send test message', 'televixo')}</Button>
				</div>
			</Card>

			<Card title={__('4. Link operators', 'televixo')} description={__('Each operator links their Telegram account once, so their replies can be authorized individually. Operators must open a private chat with the bot and press Start before linking.', 'televixo')}>
				<Button variant="ghost" onClick={() => run(async () => { const me = await api('admin/me'); setChallenge(await api(`admin/operators/${me.operator.id}/challenge`, 'POST')); })}>{__('Link my Telegram account', 'televixo')}</Button>
				{challenge && <p>{sprintf(__('Send this to @%s in a private chat within 10 minutes:', 'televixo'), challenge.bot_username)} <code>{challenge.command}</code> <Copy text={challenge.command} /></p>}
				<p className="tvxa-help">{__('Manage other operators under Operators & teams. Anonymous group admins cannot reply to visitors because they cannot be identified.', 'televixo')}</p>
			</Card>
		</div>
	);
}
