import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { api, errText } from './api';
import { Button, Card, Empty, Text, Toggle, useSaver } from './ui';
import { useSettings } from './settings';

export function Content() {
	const [canned, setCanned] = useState<any[]>([]);
	const [kb, setKb] = useState<any[]>([]);
	const [c, setC] = useState<any>({ shortcut: '', title: '', body: '' });
	const [a, setA] = useState<any>({ title: '', body: '', keywords: '', is_suggested: false });
	const s = useSaver();
	const { data, set, save, saver } = useSettings();
	useEffect(() => { api('admin/canned').then((r) => setCanned(r.items)); api('admin/kb').then((r) => setKb(r.items)); }, []);
	const run = async (fn: () => Promise<void>) => { try { await fn(); s.ok(__('Saved.', 'televixo')); } catch (e) { s.fail(errText(e)); } };
	return (
		<div className="tvxa-stack">
			{s.notice}{saver.notice}
			<Card title={__('Canned replies', 'televixo')} description={__('Type / followed by the shortcut in the inbox composer.', 'televixo')}>
				{canned.length ? <table className="tvxa-table"><tbody>{canned.map((x) => <tr key={x.id}><td><code>/{x.shortcut}</code></td><td>{x.title}</td><td className="tvxa-pre">{x.body}</td><td><Button variant="ghost" onClick={() => setC(x)}>{__('Edit', 'televixo')}</Button> <Button variant="danger" onClick={() => run(async () => setCanned((await api(`admin/canned/${x.id}`, 'DELETE')).items))}>{__('Delete', 'televixo')}</Button></td></tr>)}</tbody></table> : <Empty>{__('No canned replies yet.', 'televixo')}</Empty>}
				<div className="tvxa-grid2"><Text label={__('Shortcut', 'televixo')} value={c.shortcut} onChange={(v: string) => setC({ ...c, shortcut: v })} /><Text label={__('Title', 'televixo')} value={c.title} onChange={(v: string) => setC({ ...c, title: v })} /></div>
				<Text label={__('Reply text', 'televixo')} multiline value={c.body} onChange={(v: string) => setC({ ...c, body: v })} />
				<Button onClick={() => run(async () => { setCanned((await api('admin/canned', 'POST', c)).items); setC({ shortcut: '', title: '', body: '' }); })}>{c.id ? __('Update', 'televixo') : __('Add', 'televixo')}</Button>
			</Card>
			<Card title={__('Help articles (FAQ)', 'televixo')} description={__('Shown in the widget as searchable cards. Suggested articles appear before the visitor writes.', 'televixo')}>
				{kb.length ? <table className="tvxa-table"><tbody>{kb.map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.is_suggested === '1' || x.is_suggested === 1 ? __('Suggested', 'televixo') : ''}</td><td><Button variant="ghost" onClick={() => setA({ ...x, is_suggested: Number(x.is_suggested) === 1 })}>{__('Edit', 'televixo')}</Button> <Button variant="danger" onClick={() => run(async () => setKb((await api(`admin/kb/${x.id}`, 'DELETE')).items))}>{__('Delete', 'televixo')}</Button></td></tr>)}</tbody></table> : <Empty>{__('No articles yet.', 'televixo')}</Empty>}
				<Text label={__('Title', 'televixo')} value={a.title} onChange={(v: string) => setA({ ...a, title: v })} />
				<Text label={__('Answer', 'televixo')} multiline rows={5} value={a.body} onChange={(v: string) => setA({ ...a, body: v })} />
				<Text label={__('Search keywords', 'televixo')} value={a.keywords} onChange={(v: string) => setA({ ...a, keywords: v })} />
				<Toggle label={__('Suggest before the visitor writes', 'televixo')} checked={a.is_suggested} onChange={(v: boolean) => setA({ ...a, is_suggested: v })} />
				<Button onClick={() => run(async () => { setKb((await api('admin/kb', 'POST', a)).items); setA({ title: '', body: '', keywords: '', is_suggested: false }); })}>{a.id ? __('Update', 'televixo') : __('Add', 'televixo')}</Button>
			</Card>
			{data && <Card title={__('Welcome flow', 'televixo')} description={__('An automated first message with buttons. Automated messages are labelled in the widget and never count as human responses. “Talk to a person” options hand over to your team.', 'televixo')}>
				<Toggle label={__('Enable welcome flow', 'televixo')} checked={data.settings.automation.welcome_enabled} onChange={(v: boolean) => set('automation.welcome_enabled', v)} />
				<Text label={__('Welcome message', 'televixo')} multiline value={data.settings.automation.welcome_message} onChange={(v: string) => set('automation.welcome_message', v)} />
				<Text label={__('Options (one per line: Button label|Automated answer|handoff)', 'televixo')} multiline rows={5} value={data.settings.automation.welcome_options.map((o: any) => `${o.label}|${o.reply}|${o.handoff ? 'handoff' : ''}`).join('\n')}
					onChange={(v: string) => set('automation.welcome_options', v.split('\n').filter(Boolean).map((l) => { const [label, reply, h] = l.split('|'); return { label, reply: reply || '', handoff: h === 'handoff' }; }))} />
				<Text label={__('Suggested questions (one per line)', 'televixo')} multiline value={data.settings.widget.suggestions.join('\n')} onChange={(v: string) => set('widget.suggestions', v.split('\n').filter(Boolean))} />
				<Button onClick={() => save(['automation', 'widget'])}>{__('Save', 'televixo')}</Button>
			</Card>}
		</div>
	);
}
