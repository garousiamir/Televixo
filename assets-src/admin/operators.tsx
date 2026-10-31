import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, errText } from './api';
import { Badge, Button, Card, Copy, Empty, Notice, Select, Text, useSaver } from './ui';

export function Operators() {
	const [data, setData] = useState<any>({ items: [], candidates: [] });
	const [teams, setTeams] = useState<any[]>([]);
	const [add, setAdd] = useState('');
	const [codes, setCodes] = useState<Record<number, any>>({});
	const [team, setTeam] = useState<any>({ name: '', routing_strategy: 'manual', destination_chat_id: '' });
	const s = useSaver();
	const load = async () => { setData(await api('admin/operators')); setTeams((await api('admin/teams')).items); };
	useEffect(() => { load().catch((e) => s.fail(errText(e))); }, []);
	const run = async (fn: () => Promise<any>, ok?: string) => { try { await fn(); await load(); if (ok) s.ok(ok); } catch (e) { s.fail(errText(e)); } };

	return (
		<div className="tvxa-stack">
			{s.notice}
			<Card title={__('Operators', 'televixo')} description={__('Operators are WordPress users with the Chat Operator role (or administrators). Their Telegram account must be linked before their Telegram replies are delivered.', 'televixo')}>
				<table className="tvxa-table">
					<thead><tr><th>{__('Name', 'televixo')}</th><th>{__('Status', 'televixo')}</th><th>{__('Telegram', 'televixo')}</th><th>{__('Availability', 'televixo')}</th><th>{__('Open chats / max', 'televixo')}</th><th>{__('Teams', 'televixo')}</th><th></th></tr></thead>
					<tbody>
						{data.items.map((o: any) => (
							<tr key={o.id}>
								<td>{o.name}</td>
								<td><select className="tvxa-input tvxa-input--sm" aria-label={sprintf(__('Status of %s', 'televixo'), o.name)} value={o.status} onChange={(e: any) => run(() => api(`admin/operators/${o.id}`, 'POST', { status: e.target.value }))}><option value="active">{__('Active', 'televixo')}</option><option value="disabled">{__('Disabled', 'televixo')}</option></select></td>
								<td>{o.telegram_linked ? <><Badge tone="ok">{__('Linked', 'televixo')}</Badge> {o.telegram_username && '@' + o.telegram_username} <button type="button" className="tvxa-link" onClick={() => window.confirm(__('Unlink this Telegram account?', 'televixo')) && run(() => api(`admin/operators/${o.id}/telegram`, 'DELETE'))}>{__('Unlink', 'televixo')}</button></> : <Badge tone="warn">{__('Not linked', 'televixo')}</Badge>}
									{codes[o.id] && <div><code>{codes[o.id].command}</code> <Copy text={codes[o.id].command} /></div>}</td>
								<td>{o.present ? <Badge tone="ok">{__('Online', 'televixo')}</Badge> : <Badge>{o.availability}</Badge>}</td>
								<td><input type="number" min={1} max={100} className="tvxa-input tvxa-input--sm tvxa-input--num" aria-label={sprintf(__('Maximum chats for %s', 'televixo'), o.name)} defaultValue={o.max_concurrent} onBlur={(e: any) => run(() => api(`admin/operators/${o.id}`, 'POST', { max_concurrent: Number(e.target.value) }))} /> <span className="tvxa-muted">{o.open}</span></td>
								<td>{teams.map((t) => <label key={t.id} className="tvxa-check"><input type="checkbox" checked={o.teams.includes(Number(t.id))} onChange={(e: any) => run(() => api(`admin/operators/${o.id}`, 'POST', { teams: e.target.checked ? [...o.teams, Number(t.id)] : o.teams.filter((x: number) => x !== Number(t.id)) }))} /> {t.name}</label>)}</td>
								<td><Button variant="ghost" onClick={async () => { try { const c = await api(`admin/operators/${o.id}/challenge`, 'POST'); setCodes((x) => ({ ...x, [o.id]: c })); } catch (e) { s.fail(errText(e)); } }}>{__('Enrollment code', 'televixo')}</Button></td>
							</tr>
						))}
					</tbody>
				</table>
				{!data.items.length && <Empty>{__('No operators yet.', 'televixo')}</Empty>}
				{data.candidates.length > 0 && <div className="tvxa-row">
					<Select label={__('Add operator', 'televixo')} value={add} onChange={setAdd} options={[{ value: '', label: __('Choose a user…', 'televixo') }, ...data.candidates.filter((c: any) => !data.items.some((o: any) => o.user_id === c.id)).map((c: any) => ({ value: String(c.id), label: c.name }))]} />
					<Button disabled={!add} onClick={() => run(() => api('admin/operators', 'POST', { user_id: Number(add) }), __('Operator added.', 'televixo'))}>{__('Add', 'televixo')}</Button>
				</div>}
				<p className="tvxa-help">{__('Enrollment codes expire after 10 minutes and work once. The operator sends “/link CODE” to the bot in a private chat.', 'televixo')}</p>
			</Card>
			<Card title={__('Teams', 'televixo')} description={__('Teams scope which unassigned conversations an operator sees, and can route to their own Telegram group for isolation.', 'televixo')}>
				<table className="tvxa-table">
					<thead><tr><th>{__('Team', 'televixo')}</th><th>{__('Routing', 'televixo')}</th><th>{__('Telegram destination', 'televixo')}</th><th>{__('Members', 'televixo')}</th><th></th></tr></thead>
					<tbody>{teams.map((t) => <tr key={t.id}><td>{t.name}</td><td>{t.routing_strategy}</td><td>{t.destination_chat_id || __('Default destination', 'televixo')}</td><td>{t.members.length}</td><td><Button variant="ghost" onClick={() => setTeam(t)}>{__('Edit', 'televixo')}</Button> <Button variant="danger" onClick={() => window.confirm(__('Delete this team?', 'televixo')) && run(() => api(`admin/teams/${t.id}`, 'DELETE'))}>{__('Delete', 'televixo')}</Button></td></tr>)}</tbody>
				</table>
				<div className="tvxa-grid3">
					<Text label={__('Team name', 'televixo')} value={team.name} onChange={(v: string) => setTeam({ ...team, name: v })} />
					<Select label={__('Assignment', 'televixo')} value={team.routing_strategy} onChange={(v: string) => setTeam({ ...team, routing_strategy: v })} options={[{ value: 'manual', label: __('Manual (claim)', 'televixo') }, { value: 'round_robin', label: __('Round robin', 'televixo') }, { value: 'load', label: __('Least busy', 'televixo') }]} />
					<Text label={__('Separate Telegram chat ID (optional)', 'televixo')} value={team.destination_chat_id} onChange={(v: string) => setTeam({ ...team, destination_chat_id: v })} />
				</div>
				<Button disabled={!team.name} onClick={() => run(() => api('admin/teams', 'POST', team), __('Team saved.', 'televixo')).then(() => setTeam({ name: '', routing_strategy: 'manual', destination_chat_id: '' }))}>{team.id ? __('Update team', 'televixo') : __('Add team', 'televixo')}</Button>
				<Notice kind="info">{__('Automatic assignment only picks operators who are currently online (explicit availability plus a recent inbox heartbeat or a Telegram /online). Telegram does not report online status by itself.', 'televixo')}</Notice>
			</Card>
		</div>
	);
}
