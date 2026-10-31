import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, errText, fmtDuration } from './api';
import { Card, Empty, Notice, Text } from './ui';

export function Reports() {
	const today = new Date().toISOString().slice(0, 10);
	const month = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
	const [from, setFrom] = useState(month);
	const [to, setTo] = useState(today);
	const [r, setR] = useState<any>(null);
	const [err, setErr] = useState('');
	useEffect(() => { api(`admin/reports?from=${from}&to=${to}`).then(setR).catch((e) => setErr(errText(e))); }, [from, to]);
	if (err) return <Notice kind="error">{err}</Notice>;
	if (!r) return <p>{__('Loading…', 'televixo')}</p>;
	const max = Math.max(1, ...r.series.map((s: any) => s.conversations));
	return (
		<div className="tvxa-stack">
			<Card title={__('Reports', 'televixo')} description={sprintf(__('Dates use the site time zone (%s). Automated messages never count as responses; spam is excluded.', 'televixo'), r.range.timezone)}>
				<div className="tvxa-row">
					<Text label={__('From', 'televixo')} type="date" value={from} onChange={setFrom} />
					<Text label={__('To', 'televixo')} type="date" value={to} onChange={setTo} />
				</div>
				<div className="tvxa-kpis">
					<div><strong>{r.conversations}</strong><span>{__('Conversations', 'televixo')}</span></div>
					<div><strong>{r.unanswered}</strong><span>{__('Unanswered', 'televixo')}</span></div>
					<div><strong>{fmtDuration(r.first_response.median)}</strong><span>{__('Median first human response', 'televixo')}</span></div>
					<div><strong>{fmtDuration(r.resolution.median)}</strong><span>{__('Median resolution time', 'televixo')}</span></div>
					<div><strong>{fmtDuration(r.queue_wait.median)}</strong><span>{__('Median queue wait', 'televixo')}</span></div>
					<div><strong>{r.csat.average ?? '—'}</strong><span>{sprintf(__('CSAT (%d ratings)', 'televixo'), r.csat.responses)}</span></div>
				</div>
				<figure className="tvxa-chart" aria-label={__('Conversations per day', 'televixo')}>
					<svg viewBox={`0 0 ${r.series.length * 12} 100`} preserveAspectRatio="none" role="img" aria-hidden="true">
						{r.series.map((s: any, i: number) => <rect key={s.date} x={i * 12 + 2} width="8" y={100 - (s.conversations / max) * 96} height={(s.conversations / max) * 96}><title>{`${s.date}: ${s.conversations}`}</title></rect>)}
					</svg>
					<figcaption className="tvxa-muted">{__('Conversations per day', 'televixo')}</figcaption>
				</figure>
				<details><summary>{__('Daily table', 'televixo')}</summary><table className="tvxa-table"><tbody>{r.series.map((s: any) => <tr key={s.date}><td>{s.date}</td><td>{s.conversations}</td></tr>)}</tbody></table></details>
			</Card>
			<Card title={__('Operators', 'televixo')}>
				{r.operators.length ? <table className="tvxa-table"><thead><tr><th>{__('Operator', 'televixo')}</th><th>{__('Assignments', 'televixo')}</th><th>{__('Replies', 'televixo')}</th><th>{__('Median first response', 'televixo')}</th><th>{__('CSAT', 'televixo')}</th></tr></thead>
					<tbody>{r.operators.map((o: any) => <tr key={o.operator}><td>{o.operator}</td><td>{o.assignments}</td><td>{o.replies}</td><td>{fmtDuration(o.first_response.median)}</td><td>{o.csat ?? '—'}</td></tr>)}</tbody></table> : <Empty>{__('No data.', 'televixo')}</Empty>}
			</Card>
			<Card title={__('Teams', 'televixo')}>
				{r.teams.length ? <table className="tvxa-table"><tbody>{r.teams.map((t: any) => <tr key={t.team}><td>{t.team || __('No team', 'televixo')}</td><td>{t.conversations}</td></tr>)}</tbody></table> : <Empty>{__('No data.', 'televixo')}</Empty>}
			</Card>
			<Card title={__('Automation conversion', 'televixo')} description={__('Visitors shown a proactive message who started a conversation within 30 minutes. Counts only visitors who already had a chat session.', 'televixo')}>
				{r.automation.length ? <table className="tvxa-table"><thead><tr><th>{__('Rule', 'televixo')}</th><th>{__('Shown', 'televixo')}</th><th>{__('Conversations', 'televixo')}</th><th>{__('Rate', 'televixo')}</th></tr></thead>
					<tbody>{r.automation.map((a: any) => <tr key={a.rule_id}><td>{a.name || '#' + a.rule_id}</td><td>{a.shown}</td><td>{a.conversions}</td><td>{Math.round(a.rate * 100)}%</td></tr>)}</tbody></table> : <Empty>{__('No data.', 'televixo')}</Empty>}
			</Card>
		</div>
	);
}
