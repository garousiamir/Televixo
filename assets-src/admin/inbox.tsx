import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { api, can, cfg, errText, fmtDate } from './api';
import { Badge, Button, Empty, Notice, Tabs, usePoll } from './ui';

const STATUS_LABEL: Record<string, string> = {
	pending: __('Pending', 'televixo'),
	queued: __('Queued', 'televixo'),
	assigned: __('Assigned', 'televixo'),
	open: __('Open', 'televixo'),
	waiting: __('Waiting for visitor', 'televixo'),
	closed: __('Closed', 'televixo'),
	reopened: __('Reopened', 'televixo'),
	spam: __('Spam', 'televixo'),
};

const DELIVERY_LABEL: Record<string, [string, string]> = {
	local_accepted: [__('Saved', 'televixo'), 'neutral'],
	queued: [__('Queued for Telegram', 'televixo'), 'neutral'],
	provider_accepted: [__('Accepted by Telegram', 'televixo'), 'ok'],
	partially_sent: [__('Partially sent', 'televixo'), 'warn'],
	uncertain: [__('Delivery uncertain', 'televixo'), 'warn'],
	failed: [__('Not delivered', 'televixo'), 'bad'],
};

export function Inbox() {
	const [filter, setFilter] = useState('active');
	const [q, setQ] = useState('');
	const [items, setItems] = useState<any[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [unread, setUnread] = useState(0);
	const [selected, setSelected] = useState<string | null>(new URLSearchParams(location.search).get('conversation'));
	const [error, setError] = useState('');
	const [me, setMe] = useState<any>(null);

	const params = useCallback(() => {
		const p = new URLSearchParams();
		if (filter === 'mine') { p.set('status', 'active'); p.set('assigned', 'me'); }
		else if (filter === 'unassigned') { p.set('status', 'active'); p.set('assigned', 'unassigned'); }
		else p.set('status', filter);
		if (q) p.set('q', q);
		return p;
	}, [filter, q]);

	const load = useCallback(async () => {
		try {
			const r = await api(`admin/conversations?${params().toString()}`);
			setItems(r.items);
			setCursor(r.next_cursor);
			setUnread(r.unread);
			setError('');
		} catch (e) { setError(errText(e)); }
	}, [params]);

	usePoll(load, 5000, [filter, q]);

	useEffect(() => { api('admin/me').then(setMe).catch(() => undefined); }, []);

	// Inbox heartbeat: presence requires an explicit "online" plus this signal.
	useEffect(() => {
		const beat = () => api('admin/heartbeat', 'POST').then((r) => setMe((m: any) => ({ ...(m || {}), operator: r.operator }))).catch(() => undefined);
		beat();
		const t = window.setInterval(beat, 30000);
		return () => clearInterval(t);
	}, []);

	const more = async () => {
		if (!cursor) return;
		const p = params(); p.set('cursor', cursor);
		const r = await api(`admin/conversations?${p.toString()}`);
		setItems((cur) => [...cur, ...r.items]);
		setCursor(r.next_cursor);
	};

	const setAvailability = async (availability: string) => {
		const r = await api('admin/heartbeat', 'POST', { availability });
		setMe((m: any) => ({ ...(m || {}), operator: r.operator }));
	};

	const select = (id: string) => {
		setSelected(id);
		const url = new URL(location.href);
		url.searchParams.set('conversation', id);
		history.replaceState(null, '', url.toString());
	};

	return (
		<div className="tvxa-inbox">
			<aside className="tvxa-inbox__list" aria-label={__('Conversations', 'televixo')}>
				<div className="tvxa-inbox__presence">
					<label htmlFor="tvxa-avail">{__('My availability', 'televixo')}</label>
					<select id="tvxa-avail" className="tvxa-input tvxa-input--sm" value={me?.operator?.availability || 'offline'} onChange={(e: any) => setAvailability(e.target.value)}>
						<option value="online">{__('Available', 'televixo')}</option>
						<option value="away">{__('Away', 'televixo')}</option>
						<option value="offline">{__('Offline', 'televixo')}</option>
					</select>
					{me?.operator && <Badge tone={me.operator.present ? 'ok' : 'neutral'}>{me.operator.present ? __('Shown as online', 'televixo') : __('Not shown as online', 'televixo')}</Badge>}
				</div>
				<Tabs label={__('Filter conversations', 'televixo')} active={filter} onChange={setFilter} tabs={[
					{ id: 'active', label: __('Active', 'televixo'), count: unread },
					{ id: 'mine', label: __('Mine', 'televixo') },
					{ id: 'unassigned', label: __('Unassigned', 'televixo') },
					{ id: 'closed', label: __('Closed', 'televixo') },
					{ id: 'spam', label: __('Spam', 'televixo') },
				]} />
				<input type="search" className="tvxa-input" placeholder={__('Search name, email or reference', 'televixo')} aria-label={__('Search conversations', 'televixo')} value={q} onChange={(e: any) => setQ(e.target.value)} />
				{error && <Notice kind="error">{error}</Notice>}
				<ul className="tvxa-convlist">
					{items.map((c) => (
						<li key={c.id}>
							<button type="button" className={`tvxa-conv${selected === c.id ? ' is-active' : ''}${c.unread ? ' is-unread' : ''}`} onClick={() => select(c.id)} aria-current={selected === c.id ? 'true' : undefined}>
								<span className="tvxa-conv__top">
									<strong>{c.visitor.name || __('Visitor', 'televixo')}</strong>
									<time dateTime={c.last_message_at}>{fmtDate(c.last_message_at)}</time>
								</span>
								<span className="tvxa-conv__body">{c.last_body || '—'}</span>
								<span className="tvxa-conv__meta">
									<Badge>{STATUS_LABEL[c.status] || c.status}</Badge>
									<span>{c.reference}</span>
									{c.assigned ? <span>· {c.assigned.name}</span> : <span>· {__('Unassigned', 'televixo')}</span>}
									{c.priority > 1 && <Badge tone="warn">{__('Priority', 'televixo')}</Badge>}
									{c.unread > 0 && <span className="tvxa-unread" aria-label={sprintf(_n('%d unread message', '%d unread messages', c.unread, 'televixo'), c.unread)}>{c.unread}</span>}
								</span>
							</button>
						</li>
					))}
				</ul>
				{!items.length && <Empty>{__('No conversations here.', 'televixo')}</Empty>}
				{cursor && <Button variant="ghost" onClick={more}>{__('Load more', 'televixo')}</Button>}
			</aside>
			<main className="tvxa-inbox__detail">
				{selected ? <Conversation key={selected} id={selected} me={me} onChanged={load} /> : <Empty>{__('Select a conversation.', 'televixo')}</Empty>}
			</main>
		</div>
	);
}

function Conversation({ id, me, onChanged }: { id: string; me: any; onChanged: () => void }) {
	const [detail, setDetail] = useState<any>(null);
	const [msgs, setMsgs] = useState<any[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [notes, setNotes] = useState<any[]>([]);
	const [typing, setTyping] = useState(false);
	const [visitorRead, setVisitorRead] = useState(0);
	const [tab, setTab] = useState('reply');
	const [text, setText] = useState('');
	const [err, setErr] = useState('');
	const [canned, setCanned] = useState<any[]>([]);
	const [operators, setOperators] = useState<any[]>([]);
	const [uploads, setUploads] = useState<any[]>([]);
	const [busy, setBusy] = useState(false);
	const logRef = useRef<HTMLOListElement>(null);
	const last = useRef(0);
	const typingAt = useRef(0);

	const loadDetail = useCallback(async () => {
		try { setDetail(await api(`admin/conversations/${id}`)); } catch (e) { setErr(errText(e)); }
	}, [id]);

	const poll = useCallback(async () => {
		try {
			const r = await api(`admin/conversations/${id}/messages?after=${last.current}`);
			if (r.items.length) {
				setMsgs((cur) => {
					const seen = new Set(cur.map((m) => m.cursor));
					return [...cur, ...r.items.filter((m: any) => !seen.has(m.cursor))];
				});
				last.current = r.items[r.items.length - 1].cursor;
				api(`admin/conversations/${id}/read`, 'POST', { cursor: last.current }).catch(() => undefined);
				requestAnimationFrame(() => logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' }));
			}
			setTyping(r.visitor_typing);
			setVisitorRead(r.visitor_read);
		} catch (e) { setErr(errText(e)); }
	}, [id]);

	useEffect(() => {
		last.current = 0;
		setMsgs([]);
		(async () => {
			const r = await api(`admin/conversations/${id}/messages?limit=40`);
			setMsgs(r.items);
			setHasMore(r.has_more);
			if (r.items.length) last.current = r.items[r.items.length - 1].cursor;
			api(`admin/conversations/${id}/read`, 'POST', { cursor: last.current }).catch(() => undefined);
			requestAnimationFrame(() => logRef.current?.lastElementChild?.scrollIntoView({ block: 'end' }));
		})().catch((e) => setErr(errText(e)));
		loadDetail();
		api(`admin/conversations/${id}/notes`).then((r) => setNotes(r.items)).catch(() => undefined);
		api('admin/canned').then((r) => setCanned(r.items)).catch(() => undefined);
		api('admin/operators').then((r) => setOperators(r.items)).catch(() => undefined);
	}, [id, loadDetail]);

	usePoll(poll, 3000, [id]);

	const older = async () => {
		const first = msgs[0]?.cursor;
		const r = await api(`admin/conversations/${id}/messages?before=${first}&limit=40`);
		setMsgs((cur) => [...r.items, ...cur]);
		setHasMore(r.has_more);
	};

	const act = async (fn: () => Promise<any>) => {
		setBusy(true); setErr('');
		try { await fn(); await loadDetail(); onChanged(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
	};

	const send = async () => {
		const body = text.trim();
		const atts = uploads.filter((u) => u.id).map((u) => u.id);
		if (!body && !atts.length) return;
		await act(async () => {
			if (tab === 'note') {
				await api(`admin/conversations/${id}/notes`, 'POST', { body });
				setNotes((await api(`admin/conversations/${id}/notes`)).items);
			} else {
				await api(`admin/conversations/${id}/messages`, 'POST', { body, attachments: atts });
				setUploads([]);
				await poll();
			}
			setText('');
		});
	};

	const onType = (v: string) => {
		setText(v);
		if (tab === 'reply' && Date.now() - typingAt.current > 3000) {
			typingAt.current = Date.now();
			api(`admin/conversations/${id}/typing`, 'POST').catch(() => undefined);
		}
	};

	const upload = async (file: File) => {
		const entry = { name: file.name, id: '', error: '' };
		setUploads((u) => [...u, entry]);
		const fd = new FormData();
		fd.append('file', file);
		try {
			const res = await fetch(cfg.restUrl + `admin/conversations/${id}/attachments`, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg.nonce } });
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Upload failed');
			setUploads((u) => u.map((x) => (x === entry ? { ...x, id: data.attachment.id } : x)));
		} catch (e) {
			setUploads((u) => u.map((x) => (x === entry ? { ...x, error: errText(e) } : x)));
		}
	};

	const suggestions = text.startsWith('/') ? canned.filter((c) => c.shortcut.startsWith(text.slice(1).toLowerCase())).slice(0, 6) : [];
	const c = detail?.conversation;
	const mine = c?.assigned?.id === me?.operator?.id;
	const viewAll = can('televixo_view_all');

	return (
		<div className="tvxa-thread">
			{err && <Notice kind="error" onDismiss={() => setErr('')}>{err}</Notice>}
			{c && (
				<header className="tvxa-thread__head">
					<div>
						<h2>{c.visitor.name || __('Visitor', 'televixo')} <span className="tvxa-muted">{c.reference}</span></h2>
						<p className="tvxa-muted">
							{STATUS_LABEL[c.status]} · {c.assigned ? sprintf(__('Assigned to %s', 'televixo'), c.assigned.name) : __('Unassigned', 'televixo')} · {c.routing_mode === 'topics' ? __('Topics Mode', 'televixo') : __('Reply Mode', 'televixo')}
						</p>
					</div>
					<div className="tvxa-thread__actions">
						{!c.assigned && c.status !== 'closed' && <Button disabled={busy} onClick={() => act(() => api(`admin/conversations/${id}/claim`, 'POST'))}>{__('Claim', 'televixo')}</Button>}
						{(mine || viewAll) && c.status !== 'closed' && (
							<select className="tvxa-input tvxa-input--sm" aria-label={__('Transfer to', 'televixo')} value="" onChange={(e: any) => e.target.value && act(() => api(`admin/conversations/${id}/assign`, 'POST', { operator_id: Number(e.target.value) }))}>
								<option value="">{__('Transfer to…', 'televixo')}</option>
								{operators.filter((o) => o.status === 'active' && o.id !== c.assigned?.id).map((o) => <option key={o.id} value={o.id}>{o.name}{o.present ? ' •' : ''}</option>)}
							</select>
						)}
						{c.status === 'closed'
							? <Button variant="ghost" disabled={busy} onClick={() => act(() => api(`admin/conversations/${id}/status`, 'POST', { status: 'reopened' }))}>{__('Reopen', 'televixo')}</Button>
							: <Button variant="ghost" disabled={busy} onClick={() => act(() => api(`admin/conversations/${id}/status`, 'POST', { status: 'closed' }))}>{__('Close', 'televixo')}</Button>}
						{c.status !== 'spam' && <Button variant="ghost" disabled={busy} onClick={() => window.confirm(__('Mark as spam? Visitor messages will no longer be relayed.', 'televixo')) && act(() => api(`admin/conversations/${id}/status`, 'POST', { status: 'spam' }))}>{__('Spam', 'televixo')}</Button>}
					</div>
				</header>
			)}
			<div className="tvxa-thread__main">
				<section className="tvxa-thread__log" aria-label={__('Messages', 'televixo')}>
					{hasMore && <Button variant="ghost" onClick={older}>{__('Load earlier messages', 'televixo')}</Button>}
					<ol ref={logRef} className="tvxa-log" aria-live="polite" aria-relevant="additions">
						{msgs.map((m) => (
							<li key={m.cursor} className={`tvxa-msg tvxa-msg--${m.author}`}>
								<div className="tvxa-bubble">
									{m.author === 'automation' && <span className="tvxa-auto">{__('Automated', 'televixo')}</span>}
									{m.body && <span className="tvxa-pre">{m.body}</span>}
									{m.attachments.map((a: any) => a.kind === 'image'
										? <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"><img src={a.url + '?inline=1'} alt={a.name} className="tvxa-att-img" /></a>
										: <a key={a.id} href={a.url} className="tvxa-att">{a.name}</a>)}
								</div>
								<div className="tvxa-msg__meta">
									{m.author === 'operator' && <span>{m.author_name} · {m.source === 'telegram' ? 'Telegram' : __('Inbox', 'televixo')} · </span>}
									<time dateTime={m.created_at}>{fmtDate(m.created_at)}</time>
									{m.author === 'visitor' && DELIVERY_LABEL[m.delivery] && <> · <Badge tone={DELIVERY_LABEL[m.delivery][1]}>{DELIVERY_LABEL[m.delivery][0]}</Badge></>}
									{m.author !== 'visitor' && m.cursor <= visitorRead && <> · {__('Seen by visitor', 'televixo')}</>}
								</div>
							</li>
						))}
					</ol>
					{typing && <p className="tvxa-muted" role="status">{__('Visitor is typing…', 'televixo')}</p>}
				</section>
				{detail && <Sidebar detail={detail} notes={notes} onChanged={loadDetail} id={id} />}
			</div>
			{c && c.status !== 'spam' && (
				<div className="tvxa-composer">
					<Tabs label={__('Composer mode', 'televixo')} active={tab} onChange={setTab} tabs={[{ id: 'reply', label: __('Reply to visitor', 'televixo') }, { id: 'note', label: __('Internal note', 'televixo') }]} />
					{tab === 'note' && <p className="tvxa-help">{__('Notes are visible only to your team, never to the visitor.', 'televixo')}</p>}
					<div className="tvxa-composer__row">
						<textarea className={`tvxa-input${tab === 'note' ? ' tvxa-input--note' : ''}`} rows={3} value={text} aria-label={tab === 'note' ? __('Internal note', 'televixo') : __('Reply', 'televixo')}
							placeholder={tab === 'note' ? __('Write a note for your team…', 'televixo') : __('Type a reply… (type / for canned replies)', 'televixo')}
							onChange={(e: any) => onType(e.target.value)}
							onKeyDown={(e: any) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} />
						<div className="tvxa-composer__tools">
							{tab === 'reply' && <label className="tvxa-btn tvxa-btn--ghost">{__('Attach', 'televixo')}<input type="file" className="screen-reader-text" onChange={(e: any) => { [...(e.target.files || [])].forEach(upload); e.target.value = ''; }} /></label>}
							<Button disabled={busy} onClick={send}>{tab === 'note' ? __('Add note', 'televixo') : __('Send', 'televixo')}</Button>
						</div>
					</div>
					{suggestions.length > 0 && (
						<ul className="tvxa-canned" role="listbox" aria-label={__('Canned replies', 'televixo')}>
							{suggestions.map((s) => <li key={s.id}><button type="button" onClick={() => setText(s.body)}><strong>/{s.shortcut}</strong> {s.title}</button></li>)}
						</ul>
					)}
					{uploads.length > 0 && <ul className="tvxa-uploads">{uploads.map((u, i) => <li key={i}>{u.name} {u.error ? <Badge tone="bad">{u.error}</Badge> : u.id ? <Badge tone="ok">{__('Ready', 'televixo')}</Badge> : __('Uploading…', 'televixo')}</li>)}</ul>}
					<p className="tvxa-help">{__('Ctrl/⌘ + Enter to send. Replies are also posted to Telegram so the team sees them.', 'televixo')}</p>
				</div>
			)}
		</div>
	);
}

function Sidebar({ detail, notes, onChanged, id }: any) {
	const v = detail.visitor;
	const ctx = detail.context || {};
	const [tags, setTags] = useState((detail.tags || []).join(', '));
	const save = async (data: any) => { await api(`admin/conversations/${id}/meta`, 'POST', data); onChanged(); };
	return (
		<aside className="tvxa-thread__side" aria-label={__('Conversation details', 'televixo')}>
			<h3>{__('Visitor', 'televixo')}</h3>
			<dl className="tvxa-dl">
				<dt>{__('Name', 'televixo')}</dt><dd>{v.name || '—'}</dd>
				<dt>{__('Email', 'televixo')}</dt><dd>{v.email ? <a href={`mailto:${v.email}`}>{v.email}</a> : '—'}</dd>
				{v.phone && <><dt>{__('Phone', 'televixo')}</dt><dd>{v.phone}</dd></>}
				{v.wp_user_id > 0 && <><dt>{__('Account', 'televixo')}</dt><dd><a href={`user-edit.php?user_id=${v.wp_user_id}`}>#{v.wp_user_id}</a></dd></>}
				<dt>{__('Page', 'televixo')}</dt><dd>{ctx.page_path || '—'}</dd>
				{ctx.referrer_host && <><dt>{__('Referrer', 'televixo')}</dt><dd>{ctx.referrer_host}</dd></>}
				{ctx.utm?.campaign && <><dt>{__('Campaign', 'televixo')}</dt><dd>{ctx.utm.campaign}</dd></>}
				{ctx.device && <><dt>{__('Device', 'televixo')}</dt><dd>{ctx.device}</dd></>}
				{Object.entries(v.custom_fields || {}).map(([k, val]: any) => <><dt key={k}>{k}</dt><dd>{String(val) || '—'}</dd></>)}
				<dt>{__('First seen', 'televixo')}</dt><dd>{fmtDate(v.first_seen_at)}</dd>
				{v.consent_at && <><dt>{__('Consent', 'televixo')}</dt><dd>{fmtDate(v.consent_at)}</dd></>}
			</dl>
			{detail.rating && <p><Badge tone="ok">{sprintf(__('Rated %d/5', 'televixo'), detail.rating.score)}</Badge> {detail.rating.comment}</p>}
			<label className="tvxa-label" htmlFor="tvxa-prio">{__('Priority', 'televixo')}</label>
			<select id="tvxa-prio" className="tvxa-input tvxa-input--sm" value={detail.conversation.priority} onChange={(e: any) => save({ priority: Number(e.target.value) })}>
				<option value={0}>{__('Low', 'televixo')}</option><option value={1}>{__('Normal', 'televixo')}</option><option value={2}>{__('High', 'televixo')}</option><option value={3}>{__('Urgent', 'televixo')}</option>
			</select>
			<label className="tvxa-label" htmlFor="tvxa-tags">{__('Tags (comma separated)', 'televixo')}</label>
			<input id="tvxa-tags" className="tvxa-input tvxa-input--sm" value={tags} onChange={(e: any) => setTags(e.target.value)} onBlur={() => save({ tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean) })} />
			<h3>{__('Internal notes', 'televixo')}</h3>
			{notes.length ? <ul className="tvxa-notes">{notes.map((n: any) => <li key={n.id}><span className="tvxa-pre">{n.body}</span><small>{n.author_name} · {n.source} · {fmtDate(n.created_at)}</small></li>)}</ul> : <p className="tvxa-muted">{__('No notes yet.', 'televixo')}</p>}
			{detail.history.length > 0 && <>
				<h3>{__('Earlier conversations', 'televixo')}</h3>
				<ul className="tvxa-history">{detail.history.map((h: any) => <li key={h.id}><a href={`?page=televixo&conversation=${h.id}`}>{h.reference}</a> · {STATUS_LABEL[h.status]} · {fmtDate(h.created_at, false)}</li>)}</ul>
			</>}
			<div className="tvxa-side-actions">
				{!v.blocked && <Button variant="ghost" onClick={async () => { const reason = window.prompt(__('Reason for blocking this visitor (internal):', 'televixo')); if (reason !== null) { await api(`admin/visitors/${v.id}/block`, 'POST', { reason, network: can('televixo_manage_settings') && window.confirm(__('Also block their network address (hashed)?', 'televixo')) }); onChanged(); } }}>{__('Block visitor', 'televixo')}</Button>}
				{v.blocked && <Badge tone="bad">{__('Blocked', 'televixo')}</Badge>}
				{can('televixo_export') && <a className="tvxa-btn tvxa-btn--ghost" href={`${cfg.restUrl}admin/conversations/${id}/export?_wpnonce=${cfg.nonce}`} target="_blank" rel="noopener noreferrer">{__('Export JSON', 'televixo')}</a>}
				{can('televixo_delete') && <Button variant="danger" onClick={async () => { if (window.confirm(__('Delete this conversation and its files permanently? Copies in Telegram are not deleted.', 'televixo'))) { await api(`admin/conversations/${id}`, 'DELETE'); location.href = '?page=televixo'; } }}>{__('Delete', 'televixo')}</Button>}
			</div>
		</aside>
	);
}
