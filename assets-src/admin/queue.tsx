import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, errText, fmtDate } from './api';
import { Badge, Button, Card, Copy, Empty, Notice, Tabs, useSaver } from './ui';

const WARN: Record<string, string> = {
	worker_stale: __('The queue worker has not run in the last 10 minutes. WP-Cron only runs when the site gets traffic; set up a real cron job (below).', 'televixo'),
	queue_backlog: __('Messages have been waiting more than 5 minutes. Check the errors below and the worker schedule.', 'televixo'),
	wp_cron_disabled_without_runner: __('DISABLE_WP_CRON is set but no worker has run recently. Add the system cron job below.', 'televixo'),
};

export function Queue() {
	const [status, setStatus] = useState('dead');
	const [data, setData] = useState<any>(null);
	const [diag, setDiag] = useState<any>(null);
	const s = useSaver();
	const load = async () => setData(await api(`admin/queue?status=${status}`));
	useEffect(() => { load().catch((e) => s.fail(errText(e))); }, [status]);
	useEffect(() => { api('admin/diagnostics').then(setDiag).catch((e) => s.fail(errText(e))); }, []);
	const h = data?.health;
	const cron = `* * * * * cd ${diag ? '/path/to/wordpress' : ''} && wp televixo worker --seconds=55 --quiet`;
	return (
		<div className="tvxa-stack">
			{s.notice}
			{h && h.warnings.map((w: string) => <Notice key={w} kind="warning">{WARN[w] || w}</Notice>)}
			{diag?.storage?.publicly_reachable && <Notice kind="error">{__('Private attachments are reachable over HTTP. Your server ignores the protective rules (common on Nginx). Add this rule or define TELEVIXO_STORAGE_DIR outside the web root:', 'televixo')} <code>{diag.storage.nginx_rule}</code></Notice>}
			{diag?.secrets?.undecryptable?.length > 0 && <Notice kind="error">{__('Some secrets can no longer be decrypted (were the WordPress salts changed?). Re-enter the bot token in Setup.', 'televixo')}</Notice>}
			<Card title={__('Delivery queue', 'televixo')} actions={<Button variant="ghost" onClick={async () => { try { const r = await api('admin/queue/run', 'POST'); s.ok(sprintf(__('Processed %1$d jobs and %2$d updates.', 'televixo'), r.outbox, r.inbound)); load(); } catch (e) { s.fail(errText(e)); } }}>{__('Run worker now', 'televixo')}</Button>}>
				{h && <div className="tvxa-kpis">
					<div><strong>{h.counts.pending + h.counts.leased}</strong><span>{__('Waiting', 'televixo')}</span></div>
					<div><strong>{h.counts.uncertain}</strong><span>{__('Uncertain', 'televixo')}</span></div>
					<div><strong>{h.counts.dead}</strong><span>{__('Failed', 'televixo')}</span></div>
					<div><strong>{h.inbound_pending}</strong><span>{__('Incoming updates pending', 'televixo')}</span></div>
					<div><strong>{fmtDate(h.last_run)}</strong><span>{__('Worker last ran', 'televixo')}</span></div>
				</div>}
				<Tabs label={__('Job status', 'televixo')} active={status} onChange={setStatus} tabs={[{ id: 'dead', label: __('Failed', 'televixo') }, { id: 'uncertain', label: __('Uncertain', 'televixo') }, { id: 'pending', label: __('Waiting', 'televixo') }, { id: 'done', label: __('Delivered', 'televixo') }]} />
				{status === 'uncertain' && <p className="tvxa-help">{__('The request timed out after it may have reached Telegram. Telegram has no idempotent send, so retrying could post a duplicate. Check the Telegram chat first, then retry or discard.', 'televixo')}</p>}
				{data?.items?.length ? <table className="tvxa-table">
					<thead><tr><th>#</th><th>{__('Type', 'televixo')}</th><th>{__('Conversation', 'televixo')}</th><th>{__('Attempts', 'televixo')}</th><th>{__('Error', 'televixo')}</th><th>{__('Updated', 'televixo')}</th><th></th></tr></thead>
					<tbody>{data.items.map((j: any) => <tr key={j.id}>
						<td>{j.id}</td><td>{j.job_type}</td><td>{j.conversation ? <a href={`?page=televixo&conversation=${j.conversation}`}>{j.reference}</a> : '—'}</td>
						<td>{j.attempts}/{j.max_attempts}</td><td>{j.last_error_code && <Badge tone="bad">{j.last_error_code}</Badge>} <span className="tvxa-muted">{j.last_error}</span></td><td>{fmtDate(j.updated_at ? j.updated_at.replace(' ', 'T') + 'Z' : null)}</td>
						<td>{['dead', 'uncertain'].includes(j.status) && <><Button variant="ghost" onClick={async () => { await api(`admin/queue/${j.id}/retry`, 'POST'); load(); }}>{__('Retry', 'televixo')}</Button> <Button variant="ghost" onClick={async () => { await api(`admin/queue/${j.id}/discard`, 'POST'); load(); }}>{__('Discard', 'televixo')}</Button></>}</td>
					</tr>)}</tbody>
				</table> : <Empty>{__('Nothing here.', 'televixo')}</Empty>}
			</Card>
			<Card title={__('Background processing', 'televixo')} description={__('Messages are processed right after each request when possible and every minute by WP-Cron. WP-Cron depends on site traffic, so on low-traffic sites add a real cron job:', 'televixo')}>
				<pre className="tvxa-pre-block">{cron}</pre> <Copy text={cron} />
				<p className="tvxa-help">{__('Without WP-CLI, request wp-cron.php every minute instead (and set DISABLE_WP_CRON to true in wp-config.php):', 'televixo')}</p>
				<pre className="tvxa-pre-block">{'* * * * * curl -s https://example.com/wp-cron.php?doing_wp_cron > /dev/null'}</pre>
			</Card>
			<Card title={__('Diagnostics', 'televixo')} description={__('Redacted: contains no tokens, secrets or message content. Safe to share with support.', 'televixo')}>
				{diag ? <><pre className="tvxa-pre-block">{JSON.stringify(diag, null, 2)}</pre><Copy text={JSON.stringify(diag, null, 2)} /></> : <p>{__('Loading…', 'televixo')}</p>}
			</Card>
		</div>
	);
}
