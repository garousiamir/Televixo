import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, errText } from './api';
import { Badge, Button, Card, Empty, Notice, Select, Text, Toggle, useSaver } from './ui';

const LABELS: Record<string, string> = {
	site: __('Entire site', 'televixo'), page_id: __('Page/post IDs', 'televixo'), post_type: __('Content type', 'televixo'), template: __('Template', 'televixo'),
	term: __('Taxonomy term (taxonomy:ID)', 'televixo'), page_kind: __('Page kind', 'televixo'), url: __('URL path', 'televixo'), query: __('Query parameter', 'televixo'),
	logged_in: __('Logged in', 'televixo'), role: __('User role', 'televixo'), device: __('Device', 'televixo'), viewport_width: __('Viewport width (px)', 'televixo'),
	language: __('Site language', 'televixo'), visitor_type: __('New or returning visitor', 'televixo'), referrer_host: __('Referring site', 'televixo'),
	utm_source: __('UTM source', 'televixo'), utm_medium: __('UTM medium', 'televixo'), utm_campaign: __('UTM campaign', 'televixo'), business_hours: __('Business hours', 'televixo'),
	availability: __('Availability', 'televixo'), woo_page: __('WooCommerce page', 'televixo'), woo_product: __('WooCommerce product IDs', 'televixo'), woo_category: __('Product category IDs', 'televixo'),
	cart_value: __('Cart value', 'televixo'), cart_items: __('Cart item count', 'televixo'), time_on_page: __('Visible time on page (s)', 'televixo'), scroll_depth: __('Scroll depth (%)', 'televixo'),
	inactivity: __('Inactivity (s)', 'televixo'), exit_intent: __('Exit intent (desktop only)', 'televixo'), trigger_seen: __('Rule shown before', 'televixo'),
	conversation_state: __('Conversation state', 'televixo'), chat_opened: __('Chat opened this session', 'televixo'),
};
const OPS: Record<string, string> = { is: __('is', 'televixo'), in: __('is any of', 'televixo'), not_in: __('is none of', 'televixo'), equals: __('equals', 'televixo'), contains: __('contains', 'televixo'), wildcard: __('matches (* wildcard)', 'televixo'), not_wildcard: __('does not match', 'televixo'), exists: __('exists', 'televixo'), not_exists: __('does not exist', 'televixo'), gte: __('at least', 'televixo'), lte: __('at most', 'televixo'), empty: __('is empty', 'televixo'), within_hours: __('within the last', 'televixo'), not_within_hours: __('not within the last', 'televixo') };
const ACTIONS: Record<string, string> = { launcher: __('Show/hide launcher', 'televixo'), teaser: __('Show a teaser message', 'televixo'), open_chat: __('Open the chat', 'televixo'), auto_message: __('Show an automated message', 'televixo'), department: __('Select department', 'televixo'), greeting: __('Change greeting', 'televixo') };

const blank = () => ({ name: '', status: 'disabled', priority: 10, definition: { conditions: { op: 'and', negate: false, items: [{ type: 'site', operator: 'is', value: true }] }, exclusions: null, actions: [{ type: 'teaser', text: '' }], frequency: { per_page: 1, per_session: 1, per_visitor: null, cooldown_hours: 24, expires_at: null }, stop: { on_reply: true, on_typing: true, on_close: true, on_human: true, if_opened: true } } });

function ValueInput({ kind, value, onChange, label }: any) {
	const list = (v: any) => (Array.isArray(v) ? v.join(', ') : '');
	const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
	if (kind === 'none') return null;
	if (kind === 'bool') return <select className="tvxa-input tvxa-input--sm" aria-label={label} value={value ? '1' : '0'} onChange={(e: any) => onChange(e.target.value === '1')}><option value="1">{__('yes', 'televixo')}</option><option value="0">{__('no', 'televixo')}</option></select>;
	if (kind === 'number') return <input className="tvxa-input tvxa-input--sm tvxa-input--num" aria-label={label} type="number" value={value ?? 0} onChange={(e: any) => onChange(Number(e.target.value))} />;
	if (kind === 'string') return <input className="tvxa-input tvxa-input--sm" aria-label={label} value={value ?? ''} onChange={(e: any) => onChange(e.target.value)} />;
	if (kind === 'kv') return <><input className="tvxa-input tvxa-input--sm" aria-label={__('Parameter', 'televixo')} placeholder="ref" value={value?.key ?? ''} onChange={(e: any) => onChange({ ...value, key: e.target.value })} /><input className="tvxa-input tvxa-input--sm" aria-label={__('Value', 'televixo')} value={value?.value ?? ''} onChange={(e: any) => onChange({ ...value, value: e.target.value })} /></>;
	if (kind === 'seen') return <><input className="tvxa-input tvxa-input--sm tvxa-input--num" type="number" aria-label={__('Hours', 'televixo')} value={value?.hours ?? 24} onChange={(e: any) => onChange({ ...value, hours: Number(e.target.value) })} /><span>{__('hours (rule ID, 0 = this rule)', 'televixo')}</span><input className="tvxa-input tvxa-input--sm tvxa-input--num" type="number" aria-label={__('Rule ID', 'televixo')} value={value?.rule ?? 0} onChange={(e: any) => onChange({ ...value, rule: Number(e.target.value) })} /></>;
	if (kind.startsWith('enum:')) {
		const opts = kind.slice(5).split(',');
		const cur: string[] = Array.isArray(value) ? value : value ? [value] : [];
		if (['visitor_type', 'business_hours'].some(() => !Array.isArray(value) && value !== undefined)) {
			return <select className="tvxa-input tvxa-input--sm" aria-label={label} value={value} onChange={(e: any) => onChange(e.target.value)}>{opts.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>;
		}
		return <span className="tvxa-enum">{opts.map((o: string) => <label key={o} className="tvxa-check"><input type="checkbox" checked={cur.includes(o)} onChange={(e: any) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} /> {o}</label>)}</span>;
	}
	return <input className="tvxa-input tvxa-input--sm" aria-label={label} placeholder={kind === 'terms' ? 'category:12, post_tag:4' : 'a, b, c'} value={list(value)} onChange={(e: any) => onChange(kind === 'ints' ? split(e.target.value).map(Number).filter(Boolean) : split(e.target.value))} />;
}

function defaultValue(kind: string, type: string): any {
	if (kind === 'bool') return type === 'chat_opened' ? false : true;
	if (kind === 'number') return type === 'time_on_page' ? 15 : 0;
	if (kind === 'kv') return { key: '', value: '' };
	if (kind === 'seen') return { rule: 0, hours: 24 };
	if (kind.startsWith('enum:')) return ['visitor_type', 'business_hours'].includes(type) ? kind.slice(5).split(',')[0] : [kind.slice(5).split(',')[0]];
	if (kind === 'string') return type === 'url' ? '/' : '';
	return [];
}

function GroupEditor({ group, onChange, schema, depth = 1, onRemove }: any) {
	const update = (i: number, item: any) => onChange({ ...group, items: group.items.map((x: any, j: number) => (j === i ? item : x)) });
	const remove = (i: number) => onChange({ ...group, items: group.items.filter((_: any, j: number) => j !== i) });
	return (
		<fieldset className="tvxa-group" style={{ marginInlineStart: depth > 1 ? 16 : 0 }}>
			<legend>
				<select className="tvxa-input tvxa-input--sm" aria-label={__('Group logic', 'televixo')} value={group.op} onChange={(e: any) => onChange({ ...group, op: e.target.value })}>
					<option value="and">{__('All of these (AND)', 'televixo')}</option><option value="or">{__('Any of these (OR)', 'televixo')}</option>
				</select>
				<label className="tvxa-check"><input type="checkbox" checked={!!group.negate} onChange={(e: any) => onChange({ ...group, negate: e.target.checked })} /> {__('NOT', 'televixo')}</label>
				{onRemove && <button type="button" className="tvxa-link" onClick={onRemove}>{__('Remove group', 'televixo')}</button>}
			</legend>
			{group.items.map((item: any, i: number) => item.items
				? <GroupEditor key={i} group={item} schema={schema} depth={depth + 1} onChange={(g: any) => update(i, g)} onRemove={() => remove(i)} />
				: (
					<div className="tvxa-cond" key={i}>
						<select className="tvxa-input tvxa-input--sm" aria-label={__('Condition', 'televixo')} value={item.type} onChange={(e: any) => { const t = e.target.value; const [ops, kind] = schema[t]; update(i, { type: t, operator: ops[0], value: defaultValue(kind, t) }); }}>
							{Object.keys(schema).map((t) => <option key={t} value={t}>{LABELS[t] || t}</option>)}
						</select>
						<select className="tvxa-input tvxa-input--sm" aria-label={__('Operator', 'televixo')} value={item.operator} onChange={(e: any) => update(i, { ...item, operator: e.target.value })}>
							{schema[item.type][0].map((o: string) => <option key={o} value={o}>{OPS[o] || o}</option>)}
						</select>
						<ValueInput kind={schema[item.type][1]} value={item.value} label={LABELS[item.type]} onChange={(v: any) => update(i, { ...item, value: v })} />
						<button type="button" className="tvxa-link" aria-label={__('Remove condition', 'televixo')} onClick={() => remove(i)}>×</button>
					</div>
				))}
			<div className="tvxa-row">
				<Button variant="ghost" onClick={() => onChange({ ...group, items: [...group.items, { type: 'url', operator: 'wildcard', value: '/' }] })}>{__('Add condition', 'televixo')}</Button>
				{depth < 4 && <Button variant="ghost" onClick={() => onChange({ ...group, items: [...group.items, { op: 'or', negate: false, items: [{ type: 'site', operator: 'is', value: true }] }] })}>{__('Add group', 'televixo')}</Button>}
			</div>
		</fieldset>
	);
}

export function Rules() {
	const [rules, setRules] = useState<any[]>([]);
	const [schema, setSchema] = useState<any>(null);
	const [edit, setEdit] = useState<any>(null);
	const [ctx, setCtx] = useState('{\n  "path": "/pricing",\n  "time_on_page": 20,\n  "device": "desktop",\n  "chat_opened": false,\n  "seen": {}\n}');
	const [preview, setPreview] = useState<any>(null);
	const [imp, setImp] = useState('');
	const s = useSaver();
	const load = async () => setRules((await api('admin/rules')).items);
	useEffect(() => { load(); api('admin/rules/schema').then((r) => setSchema(r.conditions)); }, []);

	const save = async () => {
		try { await api('admin/rules', 'POST', edit); await load(); setEdit(null); s.ok(__('Rule saved.', 'televixo')); } catch (e) { s.fail(errText(e)); }
	};
	const test = async () => {
		try {
			setPreview(await api('admin/rules/preview', 'POST', edit ? { definition: edit.definition, id: edit.id || 0, priority: edit.priority, context: JSON.parse(ctx) } : { context: JSON.parse(ctx) }));
		} catch (e) { s.fail(errText(e)); }
	};
	const d = edit?.definition;
	const setD = (patch: any) => setEdit({ ...edit, definition: { ...edit.definition, ...patch } });

	return (
		<div className="tvxa-stack">
			{s.notice}
			<Card title={__('Targeting & proactive messages', 'televixo')} description={__('Rules run in the visitor’s browser (so they work with page caching). Higher priority wins each action slot; exclusions always win; one proactive message per page view; dismissing the chat stops further prompts for the session.', 'televixo')}
				actions={<><Button onClick={() => setEdit(blank())}>{__('New rule', 'televixo')}</Button> <Button variant="ghost" onClick={async () => { const d2 = await api('admin/rules/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d2, null, 2)], { type: 'application/json' })); a.download = 'televixo-rules.json'; a.click(); }}>{__('Export', 'televixo')}</Button></>}>
				{rules.length ? <table className="tvxa-table"><thead><tr><th>{__('Rule', 'televixo')}</th><th>{__('Priority', 'televixo')}</th><th>{__('Status', 'televixo')}</th><th>{__('Actions', 'televixo')}</th><th></th></tr></thead>
					<tbody>{rules.map((r) => <tr key={r.id}><td>{r.name} <span className="tvxa-muted">#{r.id}</span></td><td>{r.priority}</td><td><Badge tone={r.status === 'enabled' ? 'ok' : 'neutral'}>{r.status === 'enabled' ? __('Enabled', 'televixo') : __('Disabled', 'televixo')}</Badge></td><td>{r.definition.actions.map((a: any) => ACTIONS[a.type]).join(', ')}</td>
						<td><Button variant="ghost" onClick={() => setEdit(structuredClone(r))}>{__('Edit', 'televixo')}</Button> <Button variant="danger" onClick={async () => { if (window.confirm(__('Delete this rule?', 'televixo'))) { await api(`admin/rules/${r.id}`, 'DELETE'); load(); } }}>{__('Delete', 'televixo')}</Button></td></tr>)}</tbody></table>
					: <Empty>{__('No rules yet. Example: on /pricing*, after 15 visible seconds, if the chat was not opened and the rule was not shown in 24 hours, show a teaser once.', 'televixo')}</Empty>}
				<details><summary>{__('Import rules', 'televixo')}</summary>
					<Text label={__('Paste a rules export', 'televixo')} multiline rows={5} value={imp} onChange={setImp} />
					<Button variant="ghost" disabled={!imp} onClick={async () => { try { const r = await api('admin/rules/import', 'POST', { data: JSON.parse(imp) }); s.ok(sprintf(__('Imported %d rules (disabled).', 'televixo'), r.imported)); load(); } catch (e) { s.fail(errText(e)); } }}>{__('Import', 'televixo')}</Button>
				</details>
			</Card>
			{edit && schema && <Card title={edit.id ? sprintf(__('Edit rule #%d', 'televixo'), edit.id) : __('New rule', 'televixo')}>
				<div className="tvxa-grid3">
					<Text label={__('Name', 'televixo')} value={edit.name} onChange={(v: string) => setEdit({ ...edit, name: v })} />
					<Text label={__('Priority (higher wins)', 'televixo')} type="number" value={edit.priority} onChange={(v: number) => setEdit({ ...edit, priority: v })} />
					<Select label={__('Status', 'televixo')} value={edit.status} onChange={(v: string) => setEdit({ ...edit, status: v })} options={[{ value: 'enabled', label: __('Enabled', 'televixo') }, { value: 'disabled', label: __('Disabled', 'televixo') }]} />
				</div>
				<h3>{__('When', 'televixo')}</h3>
				<GroupEditor group={d.conditions} schema={schema} onChange={(g: any) => setD({ conditions: g })} />
				<h3>{__('Except when (exclusions)', 'televixo')}</h3>
				{d.exclusions ? <GroupEditor group={d.exclusions} schema={schema} onChange={(g: any) => setD({ exclusions: g })} onRemove={() => setD({ exclusions: null })} /> : <Button variant="ghost" onClick={() => setD({ exclusions: { op: 'or', negate: false, items: [{ type: 'woo_page', operator: 'in', value: ['checkout'] }] } })}>{__('Add exclusions', 'televixo')}</Button>}
				<h3>{__('Then', 'televixo')}</h3>
				{d.actions.map((a: any, i: number) => <div className="tvxa-cond" key={i}>
					<select className="tvxa-input tvxa-input--sm" aria-label={__('Action', 'televixo')} value={a.type} onChange={(e: any) => setD({ actions: d.actions.map((x: any, j: number) => (j === i ? { type: e.target.value, text: '', visible: true, key: '' } : x)) })}>{Object.entries(ACTIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
					{['teaser', 'auto_message', 'greeting'].includes(a.type) && <input className="tvxa-input tvxa-input--sm tvxa-grow" aria-label={__('Text', 'televixo')} value={a.text || ''} onChange={(e: any) => setD({ actions: d.actions.map((x: any, j: number) => (j === i ? { ...x, text: e.target.value } : x)) })} />}
					{a.type === 'launcher' && <select className="tvxa-input tvxa-input--sm" aria-label={__('Visibility', 'televixo')} value={a.visible ? '1' : '0'} onChange={(e: any) => setD({ actions: d.actions.map((x: any, j: number) => (j === i ? { ...x, visible: e.target.value === '1' } : x)) })}><option value="1">{__('show', 'televixo')}</option><option value="0">{__('hide', 'televixo')}</option></select>}
					{a.type === 'department' && <input className="tvxa-input tvxa-input--sm" aria-label={__('Department key', 'televixo')} value={a.key || ''} onChange={(e: any) => setD({ actions: d.actions.map((x: any, j: number) => (j === i ? { ...x, key: e.target.value } : x)) })} />}
					<button type="button" className="tvxa-link" aria-label={__('Remove action', 'televixo')} onClick={() => setD({ actions: d.actions.filter((_: any, j: number) => j !== i) })}>×</button>
				</div>)}
				<Button variant="ghost" onClick={() => setD({ actions: [...d.actions, { type: 'greeting', text: '' }] })}>{__('Add action', 'televixo')}</Button>
				<h3>{__('Frequency & stopping', 'televixo')}</h3>
				<div className="tvxa-grid4">
					<Text label={__('Max per page view', 'televixo')} type="number" value={d.frequency.per_page ?? 1} onChange={(v: number) => setD({ frequency: { ...d.frequency, per_page: v } })} />
					<Text label={__('Max per session', 'televixo')} type="number" value={d.frequency.per_session ?? ''} onChange={(v: number) => setD({ frequency: { ...d.frequency, per_session: v || null } })} />
					<Text label={__('Max per visitor', 'televixo')} type="number" value={d.frequency.per_visitor ?? ''} onChange={(v: number) => setD({ frequency: { ...d.frequency, per_visitor: v || null } })} />
					<Text label={__('Cooldown (hours)', 'televixo')} type="number" value={d.frequency.cooldown_hours ?? ''} onChange={(v: number) => setD({ frequency: { ...d.frequency, cooldown_hours: v || null } })} />
					<Text label={__('Expires on', 'televixo')} type="date" value={d.frequency.expires_at ?? ''} onChange={(v: string) => setD({ frequency: { ...d.frequency, expires_at: v || null } })} />
				</div>
				{[['on_reply', __('Stop after the visitor sends a message', 'televixo')], ['on_typing', __('Stop when the visitor starts typing', 'televixo')], ['on_close', __('Stop after the visitor closes the chat or dismisses a prompt', 'televixo')], ['on_human', __('Stop once a person has replied', 'televixo')], ['if_opened', __('Skip if the chat was already opened this session', 'televixo')]].map(([k, l]) =>
					<Toggle key={k} label={l} checked={d.stop[k] !== false} onChange={(v: boolean) => setD({ stop: { ...d.stop, [k]: v } })} />)}
				<div className="tvxa-row"><Button onClick={save}>{__('Save rule', 'televixo')}</Button><Button variant="ghost" onClick={() => setEdit(null)}>{__('Cancel', 'televixo')}</Button></div>
			</Card>}
			<Card title={__('Why does a rule match?', 'televixo')} description={__('Simulate a page view (JSON context). Keys: path, query, device, viewport_width, time_on_page, scroll_depth, logged_in, roles, post_type, woo_page, cart_value, utm, seen {ruleId: unixTime}, now…', 'televixo')}>
				<Text label={__('Context', 'televixo')} multiline rows={8} value={ctx} onChange={setCtx} />
				<Button variant="ghost" onClick={test}>{edit ? __('Test this rule', 'televixo') : __('Test all enabled rules', 'televixo')}</Button>
				{preview && <div className="tvxa-trace">
					<p>{__('Effective actions:', 'televixo')} {Object.entries(preview.actions).map(([slot, a]: any) => <Badge key={slot} tone="ok">{slot}: {a.text || (a.visible === false ? __('hide', 'televixo') : a.type)} (#{a.rule})</Badge>)}{!Object.keys(preview.actions).length && <Badge>{__('none', 'televixo')}</Badge>}</p>
					{preview.explain.map((e: any) => <details key={e.rule} open><summary><Badge tone={e.matched ? 'ok' : 'bad'}>{e.matched ? __('matched', 'televixo') : __('no match', 'televixo')}</Badge> {sprintf(__('Rule #%d', 'televixo'), e.rule)}</summary>
						<ul>{e.trace.filter((t: any) => t.type).map((t: any, i: number) => <li key={i}><Badge tone={t.result ? 'ok' : 'bad'}>{t.result ? '✓' : '✗'}</Badge> {LABELS[t.type] || t.type} {OPS[t.operator] || t.operator} <code>{JSON.stringify(t.value)}</code> — {__('actual', 'televixo')} <code>{JSON.stringify(t.actual)}</code></li>)}</ul>
					</details>)}
				</div>}
				<Notice kind="info">{__('Exit intent is detected only on desktop (mouse leaves the top of the window). There is no reliable exit intent on mobile, so it never fires there. Visitors are never fingerprinted; "returning" uses a first-party browser flag disclosed in the privacy policy text.', 'televixo')}</Notice>
			</Card>
		</div>
	);
}
