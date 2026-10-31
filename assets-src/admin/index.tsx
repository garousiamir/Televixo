import { createRoot } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Appearance } from './appearance';
import { Content } from './content';
import { Inbox } from './inbox';
import { Operators } from './operators';
import { Queue } from './queue';
import { Reports } from './reports';
import { Rules } from './rules';
import { Settings } from './settings';
import { Setup } from './setup';

const SCREENS: Record<string, [string, () => any]> = {
	inbox: [__('Inbox', 'televixo'), Inbox],
	setup: [__('Telegram setup', 'televixo'), Setup],
	operators: [__('Operators & teams', 'televixo'), Operators],
	appearance: [__('Widget', 'televixo'), Appearance],
	rules: [__('Targeting', 'televixo'), Rules],
	content: [__('Replies & FAQ', 'televixo'), Content],
	settings: [__('Settings', 'televixo'), Settings],
	reports: [__('Reports', 'televixo'), Reports],
	queue: [__('Delivery & health', 'televixo'), Queue],
};

function App({ route }: { route: string }) {
	const [title, Screen] = SCREENS[route] || SCREENS.inbox;
	return (
		<div className={`tvxa tvxa--${route}`}>
			<header className="tvxa-top"><h1>{title}</h1><span className="tvxa-brand">Televixo</span></header>
			<Screen />
		</div>
	);
}

const el = document.getElementById('televixo-admin');
if (el) createRoot(el).render(<App route={el.dataset.route || 'inbox'} />);
