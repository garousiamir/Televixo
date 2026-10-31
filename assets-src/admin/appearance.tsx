import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { cfg } from './api';
import { Button, Card, Select, Tabs, Text, Toggle } from './ui';
import { useSettings } from './settings';

function previewConfig(st: any, rtl: boolean) {
	const w = st.widget;
	return {
		version: 'preview', rest: '', enabled: true, locale: cfg.locale, rtl,
		appearance: { position: w.position, offset_x: w.offset_x, offset_y: w.offset_y, mobile_offset_x: w.mobile_offset_x, mobile_offset_y: w.mobile_offset_y, size: w.size, mobile_size: w.mobile_size, variant: w.variant, icon: w.icon, custom_icon: w.custom_icon_svg, avatar: '', accent: w.accent, z_index: 10, entrance: false, attention: false, avoid_selectors: [], sound: false, notifications: false },
		texts: { label: w.label || __('Chat with us', 'televixo'), title: w.title || document.title.split('‹')[0].trim(), subtitle: w.subtitle, greeting: w.greeting, offline: '', away: '', consent: '' },
		greeting: { bubble: false, delay: 0 }, prechat: { enabled: false, departments: [], custom_fields: [] }, offline: { behavior: 'form' },
		hours: { enabled: false, weekly: {}, holidays: [] }, uploads: { enabled: st.uploads.enabled, max_mb: st.uploads.max_mb, accept: st.uploads.types, voice: false },
		csat: st.csat, transcript: false, suggestions: w.suggestions, kb: [], kb_search: false, excluded_paths: [], rules: [], limits: { max_chars: 4000 },
	};
}

export function Appearance() {
	const { data, set, save, saver } = useSettings();
	const [device, setDevice] = useState('desktop');
	const [rtl, setRtl] = useState(!!cfg.rtl);
	const stage = useRef<HTMLDivElement>(null);
	const handle = useRef<any>(null);

	useEffect(() => {
		if (!data || !stage.current) return;
		const conf = previewConfig(data.settings, rtl);
		const boot = { config: conf, page: {}, css: cfg.widgetPreview.css, i18n: cfg.widgetPreview.i18n, mount: stage.current };
		const mount = () => {
			if (!window.televixoPreview) return;
			if (!handle.current) handle.current = window.televixoPreview.mount(boot);
			else handle.current.update(conf);
		};
		if (window.televixoPreview) mount();
		else if (!document.getElementById('televixo-preview-script')) {
			const s = document.createElement('script');
			s.id = 'televixo-preview-script';
			s.src = cfg.widgetPreview.script;
			s.onload = mount;
			document.head.appendChild(s);
		}
	}, [data, rtl]);

	if (!data) return <>{saver.notice}<p>{__('Loading…', 'televixo')}</p></>;
	const w = data.settings.widget;
	const ws = (k: string) => (v: any) => set('widget.' + k, v);
	return (
		<div className="tvxa-appearance">
			<div className="tvxa-stack">
				{saver.notice}
				<Card title={__('Launcher', 'televixo')}>
					<Toggle label={__('Show the chat widget on the site', 'televixo')} checked={w.enabled} onChange={ws('enabled')} />
					<div className="tvxa-grid2">
						<Select label={__('Style', 'televixo')} value={w.variant} onChange={ws('variant')} options={[{ value: 'pill', label: __('Pill with label', 'televixo') }, { value: 'circle', label: __('Circle', 'televixo') }]} />
						<Select label={__('Position', 'televixo')} value={w.position} onChange={ws('position')} options={[{ value: 'end', label: __('End (right in LTR, left in RTL)', 'televixo') }, { value: 'start', label: __('Start (left in LTR, right in RTL)', 'televixo') }, { value: 'right', label: __('Always right', 'televixo') }, { value: 'left', label: __('Always left', 'televixo') }]} />
						<Text label={__('Label', 'televixo')} value={w.label} onChange={ws('label')} placeholder={__('Chat with us', 'televixo')} />
						<Select label={__('Icon', 'televixo')} value={w.icon} onChange={ws('icon')} options={[{ value: 'chat', label: __('Chat bubble', 'televixo') }, { value: 'discuss', label: __('Discussion', 'televixo') }, { value: 'help', label: __('Help', 'televixo') }, { value: 'mail', label: __('Mail', 'televixo') }, { value: 'custom', label: __('Custom SVG', 'televixo') }]} />
					</div>
					{w.icon === 'custom' && <Text label={__('Custom SVG icon', 'televixo')} multiline value={w.custom_icon_svg} onChange={ws('custom_icon_svg')} help={__('Only basic shapes are kept; scripts, links and styles are removed on save.', 'televixo')} />}
					<div className="tvxa-grid4">
						<Text label={__('Desktop side offset (px)', 'televixo')} type="number" value={w.offset_x} onChange={ws('offset_x')} />
						<Text label={__('Desktop bottom offset (px)', 'televixo')} type="number" value={w.offset_y} onChange={ws('offset_y')} />
						<Text label={__('Mobile side offset (px)', 'televixo')} type="number" value={w.mobile_offset_x} onChange={ws('mobile_offset_x')} />
						<Text label={__('Mobile bottom offset (px)', 'televixo')} type="number" value={w.mobile_offset_y} onChange={ws('mobile_offset_y')} />
						<Text label={__('Desktop size (px)', 'televixo')} type="number" value={w.size} onChange={ws('size')} />
						<Text label={__('Mobile size (px)', 'televixo')} type="number" value={w.mobile_size} onChange={ws('mobile_size')} />
						<Text label={__('Stacking order (z-index)', 'televixo')} type="number" value={w.z_index} onChange={ws('z_index')} />
						<Text label={__('Header & bubble colour', 'televixo')} type="color" value={w.accent} onChange={ws('accent')} />
					</div>
					<Toggle label={__('Entrance animation', 'televixo')} checked={w.entrance_animation} onChange={ws('entrance_animation')} />
					<Toggle label={__('Gentle attention nudge when a message is shown (once, never looping)', 'televixo')} checked={w.attention_animation} onChange={ws('attention_animation')} help={__('Animations are always disabled for visitors who prefer reduced motion.', 'televixo')} />
					<Text label={__('Move the launcher above these elements (CSS selectors, one per line)', 'televixo')} multiline value={w.avoid_selectors} onChange={ws('avoid_selectors')} help={__('Common cookie banners and WooCommerce checkout buttons are avoided automatically.', 'televixo')} />
				</Card>
				<Card title={__('Chat window', 'televixo')}>
					<div className="tvxa-grid2">
						<Text label={__('Title', 'televixo')} value={w.title} onChange={ws('title')} />
						<Text label={__('Subtitle (e.g. typical reply time)', 'televixo')} value={w.subtitle} onChange={ws('subtitle')} />
					</div>
					<Text label={__('Greeting', 'televixo')} multiline value={w.greeting} onChange={ws('greeting')} />
					<Toggle label={__('Show the greeting as a bubble next to the launcher', 'televixo')} checked={w.greeting_bubble} onChange={ws('greeting_bubble')} />
					<Text label={__('Greeting bubble delay (seconds of visible time)', 'televixo')} type="number" value={w.greeting_delay} onChange={ws('greeting_delay')} />
					<Toggle label={__('Show help articles', 'televixo')} checked={w.show_kb} onChange={ws('show_kb')} />
					<Toggle label={__('Allow sound notifications (visitors can turn them off)', 'televixo')} checked={w.sound} onChange={ws('sound')} />
					<Toggle label={__('Offer browser notifications after the visitor writes', 'televixo')} checked={w.browser_notifications} onChange={ws('browser_notifications')} />
					<Text label={__('Hide on these paths (one per line, * wildcard)', 'televixo')} multiline value={w.excluded_paths} onChange={ws('excluded_paths')} placeholder="/checkout*" help={__('On excluded paths no widget code is loaded at all.', 'televixo')} />
				</Card>
				<Button onClick={() => save(['widget'])}>{__('Save widget settings', 'televixo')}</Button>
			</div>
			<div className="tvxa-preview-col">
				<Tabs label={__('Preview size', 'televixo')} active={device} onChange={setDevice} tabs={[{ id: 'desktop', label: __('Desktop', 'televixo') }, { id: 'tablet', label: __('Tablet', 'televixo') }, { id: 'mobile', label: __('Mobile', 'televixo') }]} />
				<Toggle label={__('Right-to-left preview', 'televixo')} checked={rtl} onChange={setRtl} />
				<div className={`tvxa-stage tvxa-stage--${device}`} ref={stage} aria-label={__('Live preview', 'televixo')} />
				<p className="tvxa-help">{__('The preview uses sample messages and does not contact your site or Telegram. Unsaved changes are shown immediately.', 'televixo')}</p>
			</div>
		</div>
	);
}
