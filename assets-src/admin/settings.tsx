import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { api, errText } from './api';
import { Button, Card, Notice, Select, Tabs, Text, Toggle, useSaver } from './ui';

export function useSettings() {
	const [data, setData] = useState<any>(null);
	const s = useSaver();
	useEffect(() => { api('admin/settings').then(setData).catch((e) => s.fail(errText(e))); }, []);
	const set = (path: string, value: any) => setData((d: any) => {
		const next = structuredClone(d);
		let ref = next.settings;
		const keys = path.split('.');
		keys.slice(0, -1).forEach((k) => { ref = ref[k]; });
		ref[keys[keys.length - 1]] = value;
		return next;
	});
	const save = async (part?: string[]) => {
		try {
			const body = part ? Object.fromEntries(part.map((k) => [k, data.settings[k]])) : data.settings;
			setData(await api('admin/settings', 'POST', { settings: body }));
			s.ok(__('Settings saved.', 'televixo'));
		} catch (e) { s.fail(errText(e)); }
	};
	return { data, set, save, saver: s };
}

const MODES = [{ value: 'hidden', label: __('Hidden', 'televixo') }, { value: 'optional', label: __('Optional', 'televixo') }, { value: 'required', label: __('Required', 'televixo') }];
const DAYS: [string, string][] = [['mon', __('Monday', 'televixo')], ['tue', __('Tuesday', 'televixo')], ['wed', __('Wednesday', 'televixo')], ['thu', __('Thursday', 'televixo')], ['fri', __('Friday', 'televixo')], ['sat', __('Saturday', 'televixo')], ['sun', __('Sunday', 'televixo')]];

export function Settings() {
	const { data, set, save, saver } = useSettings();
	const [tab, setTab] = useState('routing');
	const [teams, setTeams] = useState<any[]>([]);
	const [importText, setImportText] = useState('');
	useEffect(() => { api('admin/teams').then((r) => setTeams(r.items)).catch(() => undefined); }, []);
	if (!data) return <>{saver.notice}<p>{__('Loading…', 'televixo')}</p></>;
	const st = data.settings;
	const lines = (v: string[]) => (v || []).join('\n');
	const parse = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);

	return (
		<div className="tvxa-stack">
			{saver.notice}
			<Tabs label={__('Settings sections', 'televixo')} active={tab} onChange={setTab} tabs={[
				{ id: 'routing', label: __('Routing', 'televixo') }, { id: 'prechat', label: __('Pre-chat', 'televixo') }, { id: 'hours', label: __('Hours & offline', 'televixo') },
				{ id: 'files', label: __('Files & ratings', 'televixo') }, { id: 'privacy', label: __('Privacy & security', 'televixo') }, { id: 'transfer', label: __('Import / export', 'televixo') },
			]} />
			{tab === 'routing' && <Card title={__('Routing & Telegram behaviour', 'televixo')}>
				<div className="tvxa-grid2">
					<Select label={__('Automatic assignment', 'televixo')} value={st.routing.strategy} onChange={(v: string) => set('routing.strategy', v)} options={[{ value: 'manual', label: __('Manual – operators claim', 'televixo') }, { value: 'round_robin', label: __('Round robin among online operators', 'televixo') }, { value: 'load', label: __('Least busy online operator', 'televixo') }]} />
					<Select label={__('Default team', 'televixo')} value={String(st.routing.default_team_id)} onChange={(v: string) => set('routing.default_team_id', Number(v))} options={[{ value: '0', label: __('None', 'televixo') }, ...teams.map((t) => ({ value: String(t.id), label: t.name }))]} />
					<Select label={__('Topics Mode forwarding', 'televixo')} value={st.telegram.topic_forwarding} onChange={(v: string) => set('telegram.topic_forwarding', v)} options={[{ value: 'operator_messages', label: __('Every message from an enrolled operator', 'televixo') }, { value: 'replies_only', label: __('Only explicit replies to visitor messages', 'televixo') }]} help={__('Messages from group members who are not enrolled operators are never forwarded.', 'televixo')} />
					<Text label={__('Internal note prefix', 'televixo')} value={st.telegram.note_prefix} onChange={(v: string) => set('telegram.note_prefix', v)} help={__('Telegram messages starting with this become internal notes.', 'televixo')} />
					<Select label={__('When a send times out', 'televixo')} value={st.telegram.uncertain_policy} onChange={(v: string) => set('telegram.uncertain_policy', v)} options={[{ value: 'hold', label: __('Hold for review (no duplicates)', 'televixo') }, { value: 'retry', label: __('Retry automatically (may duplicate)', 'televixo') }]} />
				</div>
				<Toggle label={__('Replying in Telegram claims an unassigned conversation', 'televixo')} checked={st.telegram.auto_claim_on_reply} onChange={(v: boolean) => set('telegram.auto_claim_on_reply', v)} />
				<Toggle label={__('Recreate a topic if it was deleted', 'televixo')} checked={st.telegram.recreate_deleted_topics} onChange={(v: boolean) => set('telegram.recreate_deleted_topics', v)} />
				<fieldset className="tvxa-fieldset"><legend>{__('Context sent to Telegram with each new conversation', 'televixo')}</legend>
					{[['name', __('Name', 'televixo')], ['email', __('Email', 'televixo')], ['phone', __('Phone', 'televixo')], ['page', __('Page path', 'televixo')], ['department', __('Department', 'televixo')], ['referrer', __('Referring site', 'televixo')]].map(([k, l]) => (
						<label key={k} className="tvxa-check"><input type="checkbox" checked={st.telegram.context_fields.includes(k)} onChange={(e: any) => set('telegram.context_fields', e.target.checked ? [...st.telegram.context_fields, k] : st.telegram.context_fields.filter((x: string) => x !== k))} /> {l}</label>
					))}
					<p className="tvxa-help">{__('Send only what operators need: everything relayed is stored by Telegram and visible to every group member.', 'televixo')}</p>
				</fieldset>
				<Button onClick={() => save(['routing', 'telegram'])}>{__('Save', 'televixo')}</Button>
			</Card>}
			{tab === 'prechat' && <Card title={__('Pre-chat form', 'televixo')}>
				<Toggle label={__('Ask for details before the chat starts', 'televixo')} checked={st.prechat.enabled} onChange={(v: boolean) => set('prechat.enabled', v)} />
				<div className="tvxa-grid3">
					{[['name', __('Name', 'televixo')], ['email', __('Email', 'televixo')], ['phone', __('Phone', 'televixo')], ['department', __('Department', 'televixo')], ['consent', __('Consent checkbox', 'televixo')]].map(([k, l]) => <Select key={k} label={l} value={st.prechat[k]} onChange={(v: string) => set('prechat.' + k, v)} options={MODES} />)}
				</div>
				<Text label={__('Consent text (links allowed)', 'televixo')} multiline value={st.prechat.consent_text} onChange={(v: string) => set('prechat.consent_text', v)} />
				<Text label={__('Departments (one per line: key|Label|team ID)', 'televixo')} multiline value={st.prechat.departments.map((d: any) => `${d.key}|${d.label}|${d.team_id || ''}`).join('\n')} onChange={(v: string) => set('prechat.departments', parse(v).map((l) => { const [key, label, team] = l.split('|'); return { key, label: label || key, team_id: Number(team) || 0 }; }))} />
				<Text label={__('Custom fields (one per line: key|Label|text, textarea or select|required|option1,option2)', 'televixo')} multiline value={st.prechat.custom_fields.map((c: any) => `${c.key}|${c.label}|${c.type}|${c.required ? 'required' : ''}|${(c.options || []).join(',')}`).join('\n')} onChange={(v: string) => set('prechat.custom_fields', parse(v).map((l) => { const [key, label, type, req, opts] = l.split('|'); return { key, label: label || key, type: type || 'text', required: req === 'required', options: (opts || '').split(',').map((o) => o.trim()).filter(Boolean) }; }))} />
				<Button onClick={() => save(['prechat'])}>{__('Save', 'televixo')}</Button>
			</Card>}
			{tab === 'hours' && <Card title={__('Business hours & offline behaviour', 'televixo')} description={__('The widget shows "online" only when an operator is actually available. Hours only control when chat is open.', 'televixo')}>
				<Toggle label={__('Use business hours', 'televixo')} checked={st.hours.enabled} onChange={(v: boolean) => set('hours.enabled', v)} />
				<Text label={__('Time zone (IANA name, empty = site time zone)', 'televixo')} value={st.hours.timezone} onChange={(v: string) => set('hours.timezone', v)} placeholder="Europe/Lisbon" />
				<table className="tvxa-table"><tbody>{DAYS.map(([k, l]) => <tr key={k}><th scope="row">{l}</th><td>
					<input className="tvxa-input tvxa-input--sm" aria-label={l} placeholder="09:00-17:00, 18:00-20:00" defaultValue={(st.hours.weekly[k] || []).map((r: string[]) => r.join('-')).join(', ')}
						onBlur={(e: any) => set('hours.weekly.' + k, e.target.value.split(',').map((x: string) => x.trim().split('-')).filter((r: string[]) => r.length === 2))} />
				</td></tr>)}</tbody></table>
				<Text label={__('Holidays (one per line: YYYY-MM-DD Label)', 'televixo')} multiline value={st.hours.holidays.map((h: any) => `${h.date} ${h.label}`).join('\n')} onChange={(v: string) => set('hours.holidays', parse(v).map((l) => ({ date: l.slice(0, 10), label: l.slice(11) })))} />
				<Toggle label={__('Temporarily away (overrides everything)', 'televixo')} checked={st.hours.away} onChange={(v: boolean) => set('hours.away', v)} />
				<Text label={__('Away message', 'televixo')} multiline value={st.hours.away_message} onChange={(v: string) => set('hours.away_message', v)} />
				<Toggle label={__('Require an online operator to show "online"', 'televixo')} checked={st.hours.presence_required} onChange={(v: boolean) => set('hours.presence_required', v)} help={__('When off, the widget shows "Within business hours" instead of claiming someone is online.', 'televixo')} />
				<Select label={__('When nobody is available', 'televixo')} value={st.offline.behavior} onChange={(v: string) => set('offline.behavior', v)} options={[{ value: 'form', label: __('Show an offline message form', 'televixo') }, { value: 'accept', label: __('Accept chat messages anyway', 'televixo') }, { value: 'hide', label: __('Hide the chat', 'televixo') }]} />
				<Text label={__('Offline message', 'televixo')} multiline value={st.offline.message} onChange={(v: string) => set('offline.message', v)} />
				<Text label={__('Email offline messages to', 'televixo')} type="email" value={st.offline.notify_email} onChange={(v: string) => set('offline.notify_email', v)} />
				<Button onClick={() => save(['hours', 'offline'])}>{__('Save', 'televixo')}</Button>
			</Card>}
			{tab === 'files' && <Card title={__('Files, voice & ratings', 'televixo')}>
				<Toggle label={__('Allow visitors to send files', 'televixo')} checked={st.uploads.enabled} onChange={(v: boolean) => set('uploads.enabled', v)} />
				<fieldset className="tvxa-fieldset"><legend>{__('Allowed types (content is verified on the server; SVG and executables are always refused)', 'televixo')}</legend>
					{['jpg', 'png', 'gif', 'webp', 'pdf', 'txt', 'csv', 'docx', 'xlsx'].map((t) => <label key={t} className="tvxa-check"><input type="checkbox" checked={st.uploads.types.includes(t)} onChange={(e: any) => set('uploads.types', e.target.checked ? [...st.uploads.types, t] : st.uploads.types.filter((x: string) => x !== t))} /> {t}</label>)}
				</fieldset>
				<div className="tvxa-grid2">
					<Text label={__('Maximum file size (MB, ≤ 20)', 'televixo')} type="number" value={st.uploads.max_mb} onChange={(v: number) => set('uploads.max_mb', v)} />
					<Text label={__('Storage quota per conversation (MB)', 'televixo')} type="number" value={st.uploads.quota_per_conversation_mb} onChange={(v: number) => set('uploads.quota_per_conversation_mb', v)} />
				</div>
				<Toggle label={__('Voice messages', 'televixo')} checked={st.uploads.voice} onChange={(v: boolean) => set('uploads.voice', v)} help={__('Recording asks for microphone permission when the visitor presses the button. Only browsers that record OGG/Opus or M4A (Telegram voice formats) show the button; others can still attach a file.', 'televixo')} />
				<Toggle label={__('Ask for a rating when a chat ends', 'televixo')} checked={st.csat.enabled} onChange={(v: boolean) => set('csat.enabled', v)} />
				<Toggle label={__('Allow a comment with the rating', 'televixo')} checked={st.csat.comment} onChange={(v: boolean) => set('csat.comment', v)} />
				<Button onClick={() => save(['uploads', 'csat'])}>{__('Save', 'televixo')}</Button>
			</Card>}
			{tab === 'privacy' && <Card title={__('Privacy, retention & security', 'televixo')}>
				<div className="tvxa-grid2">
					<Text label={__('Delete closed conversations after (days, 0 = keep)', 'televixo')} type="number" value={st.privacy.retention_days} onChange={(v: number) => set('privacy.retention_days', v)} />
					<Text label={__('Keep audit events for (days)', 'televixo')} type="number" value={st.privacy.event_retention_days} onChange={(v: number) => set('privacy.event_retention_days', v)} />
				</div>
				<Toggle label={__('Let visitors download a transcript', 'televixo')} checked={st.privacy.transcript_download} onChange={(v: boolean) => set('privacy.transcript_download', v)} />
				<Text label={__('Trusted reverse proxies (one IP or CIDR per line)', 'televixo')} multiline value={lines(st.privacy.trusted_proxies)} onChange={(v: string) => set('privacy.trusted_proxies', parse(v))} help={__('Only requests from these addresses may set X-Forwarded-For. Leave empty unless you use a proxy or CDN.', 'televixo')} />
				<div className="tvxa-grid2">
					<Text label={__('Messages per visitor per minute', 'televixo')} type="number" value={st.limits.messages_per_minute} onChange={(v: number) => set('limits.messages_per_minute', v)} />
					<Text label={__('New sessions per network per hour', 'televixo')} type="number" value={st.limits.sessions_per_hour} onChange={(v: number) => set('limits.sessions_per_hour', v)} />
					<Text label={__('Uploads per visitor per hour', 'televixo')} type="number" value={st.limits.uploads_per_hour} onChange={(v: number) => set('limits.uploads_per_hour', v)} />
					<Text label={__('Maximum message length (characters)', 'televixo')} type="number" value={st.limits.max_message_chars} onChange={(v: number) => set('limits.max_message_chars', v)} />
				</div>
				<Notice kind="warning">{__('Messages already delivered to Telegram are not deleted from Telegram when they are deleted here.', 'televixo')}</Notice>
				<Toggle label={__('Delete all Televixo data when the plugin is deleted', 'televixo')} checked={st.privacy.delete_on_uninstall} onChange={(v: boolean) => set('privacy.delete_on_uninstall', v)} help={__('Off by default. Deactivating never deletes data.', 'televixo')} />
				<Button onClick={() => save(['privacy', 'limits'])}>{__('Save', 'televixo')}</Button>
				<p><Button variant="ghost" onClick={async () => { const r = await api('admin/privacy/run-retention', 'POST'); window.alert(JSON.stringify(r)); }}>{__('Run retention cleanup now', 'televixo')}</Button></p>
			</Card>}
			{tab === 'transfer' && <Card title={__('Import / export settings', 'televixo')} description={__('Exports never include the bot token or webhook secret.', 'televixo')}>
				<Button variant="ghost" onClick={async () => { const d = await api('admin/settings/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'televixo-settings.json'; a.click(); }}>{__('Download export', 'televixo')}</Button>
				<Text label={__('Paste an export to import', 'televixo')} multiline rows={6} value={importText} onChange={setImportText} />
				<Button disabled={!importText} onClick={async () => { try { const r = await api('admin/settings/import', 'POST', { data: JSON.parse(importText), include_rules: true }); saver.ok(__('Imported. Rules were imported disabled.', 'televixo') + (r.rules.errors.length ? ' ' + r.rules.errors.join('; ') : '')); } catch (e) { saver.fail(errText(e)); } }}>{__('Import', 'televixo')}</Button>
			</Card>}
		</div>
	);
}
