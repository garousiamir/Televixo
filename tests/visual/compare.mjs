// Visual comparison: reference chat panel vs Televixo widget rendered in the
// same reference page at matching sizes, LTR and RTL. Reference dependencies
// (Tailwind browser build, Alpine, Swiper, Hanken Grotesk) are served from
// local npm copies; every other external request is blocked.
//   REF_DEPS=/path/to/node_modules VIS_DEPS=/path/with/pixelmatch node tests/visual/compare.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = require('playwright');
const DEPS = process.env.REF_DEPS || '/tmp/claude-0/refdeps/node_modules';
const VIS = process.env.VIS_DEPS || '/tmp/claude-0/vis/node_modules';
const pixelmatch = require(join(VIS, 'pixelmatch'));
const { PNG } = require(join(VIS, 'pngjs'));
const REF = join(root, 'refrence-html');
const OUT = join(root, 'docs/visual');
mkdirSync(OUT, { recursive: true });

const fontCss = [400, 500, 900].map((w) => `@font-face{font-family:'Hanken Grotesk';font-weight:${w};src:url(https://fonts.gstatic.com/hg-${w}.woff2) format('woff2')}`).join('');
const GREETING = 'Hi! I’m Clara from the Chio studio. Looking for a size, an order update or something else?';
const ANSWER = 'Tell me your height and the size you usually wear — most of our knits and sweatshirts run relaxed, so many customers size down.';

async function route(page) {
	await page.route('**/*', async (r) => {
		const u = r.request().url();
		if (u.startsWith('file://')) return r.continue();
		if (u.includes('@tailwindcss/browser')) return r.fulfill({ path: DEPS + '/@tailwindcss/browser/dist/index.global.js', contentType: 'text/javascript' });
		if (u.includes('alpinejs')) return r.fulfill({ path: DEPS + '/alpinejs/dist/cdn.min.js', contentType: 'text/javascript' });
		if (u.includes('swiper-bundle.min.js')) return r.fulfill({ path: DEPS + '/swiper/swiper-bundle.min.js', contentType: 'text/javascript' });
		if (u.includes('swiper-bundle.min.css')) return r.fulfill({ path: DEPS + '/swiper/swiper-bundle.min.css', contentType: 'text/css' });
		if (u.includes('fonts.googleapis.com')) return r.fulfill({ body: fontCss, contentType: 'text/css' });
		const m = u.match(/hg-(\d+)\.woff2/);
		if (m) return r.fulfill({ path: `${DEPS}/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-${m[1]}-normal.woff2`, contentType: 'font/woff2' });
		return r.abort();
	});
}

function crop(buf, box) {
	const src = PNG.sync.read(buf);
	const out = new PNG({ width: Math.round(box.width), height: Math.round(box.height) });
	PNG.bitblt(src, out, Math.round(box.x), Math.round(box.y), out.width, out.height, 0, 0);
	return out;
}

function fit(png, w, h) {
	const out = new PNG({ width: w, height: h });
	out.data.fill(255);
	PNG.bitblt(png, out, 0, 0, Math.min(w, png.width), Math.min(h, png.height), 0, 0);
	return out;
}

const browser = await chromium.launch();
const results = [];
const sizes = [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]];
for (const [name, w, h] of sizes) {
	for (const dir of ['ltr', 'rtl']) {
		const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
		await route(page);
		await page.goto('file://' + REF + '/chio-contact.html');
		await page.waitForTimeout(1200);
		if (dir === 'rtl') await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
		await page.evaluate(() => window.dispatchEvent(new CustomEvent('chio-chat-open')));
		await page.fill('#chat-input', 'Which size am I?');
		await page.press('#chat-input', 'Enter');
		await page.waitForTimeout(1600);
		await page.evaluate(() => document.activeElement && document.activeElement.blur());
		const refBox = await page.locator('[role=dialog][aria-labelledby=chat-title]').boundingBox();
		const refShot = await page.screenshot();
		// Hide the reference panel, inject the Televixo widget into the same page.
		await page.evaluate(() => { document.querySelector('[role=dialog][aria-labelledby=chat-title]').style.display = 'none'; });
		await page.addStyleTag({ content: '#tvx-stage{position:fixed;inset:0;z-index:70;pointer-events:none}' });
		await page.evaluate(() => { const d = document.createElement('div'); d.id = 'tvx-stage'; document.body.appendChild(d); });
		const css = 'file://' + join(root, 'televixo/assets/build/widget.css');
		const i18n = { s: { send: 'Send', placeholder: 'Type your message…', online: 'Online now', today: 'Today', you: 'You', team: 'Support', sent: 'Sent', read: 'Seen', close: 'Close chat', more: 'More options', attach: 'Attach a file', emoji: 'Insert emoji', input_label: 'Type your message', messages: 'Messages', typing: 'An operator is typing…' }, p: {}, plural: 'n != 1' };
		await page.addScriptTag({ path: join(root, 'televixo/assets/build/widget.js') });
		await page.evaluate(({ css, i18n, rtl, avatar, GREETING, ANSWER }) => {
			const config = { version: 'x', rest: '', enabled: true, locale: 'en_US', rtl,
				appearance: { position: 'end', offset_x: 24, offset_y: 24, mobile_offset_x: 12, mobile_offset_y: 24, size: 56, mobile_size: 52, variant: 'circle', icon: 'chat', custom_icon: '', avatar, accent: '#1c1c1c', z_index: 70, entrance: false, attention: false, avoid_selectors: [], sound: false, notifications: false },
				texts: { label: 'Chat with us', title: 'Chio care', subtitle: 'Clara usually replies in minutes', greeting: GREETING, offline: '', away: '', consent: '' },
				greeting: { bubble: false, delay: 0 }, prechat: { enabled: false, departments: [], custom_fields: [] }, offline: { behavior: 'form' }, hours: { enabled: false, weekly: {}, holidays: [] },
				uploads: { enabled: true, max_mb: 10, accept: ['png'], voice: false }, csat: { enabled: true, comment: true }, transcript: false, suggestions: ['Where is my order?', 'Which size am I?', 'Start a return'], kb: [], kb_search: false, excluded_paths: [], rules: [], limits: { max_chars: 4000 } };
			window.televixoPreview.mount({ config, page: {}, css, i18n, mount: document.getElementById('tvx-stage'), sample: { typing: false, question: 'Which size am I?', answer: ANSWER } });
		}, { css, i18n, rtl: dir === 'rtl', avatar: 'file://' + REF + '/assets/images/chio/pages/contact-portrait.jpg', GREETING, ANSWER });
		await page.waitForTimeout(900);
		const ours = page.locator('#televixo-root >> css=#tvx-panel');
		const ourBox = await ours.boundingBox();
		const ourShot = await page.screenshot();
		const a = crop(refShot, refBox);
		const b = crop(ourShot, ourBox);
		const W = Math.max(a.width, b.width), H = Math.max(a.height, b.height);
		const fa = fit(a, W, H), fb = fit(b, W, H), diff = new PNG({ width: W, height: H });
		const px = pixelmatch(fa.data, fb.data, diff.data, W, H, { threshold: 0.15 });
		const side = new PNG({ width: W * 3 + 32, height: H });
		side.data.fill(255);
		PNG.bitblt(fa, side, 0, 0, W, H, 0, 0);
		PNG.bitblt(fb, side, 0, 0, W, H, W + 16, 0);
		PNG.bitblt(diff, side, 0, 0, W, H, 2 * W + 32, 0);
		const file = `compare-${name}-${dir}.png`;
		writeFileSync(join(OUT, file), PNG.sync.write(side));
		results.push({ size: name, dir, reference: { w: Math.round(refBox.width), h: Math.round(refBox.height), x: Math.round(refBox.x) }, televixo: { w: Math.round(ourBox.width), h: Math.round(ourBox.height), x: Math.round(ourBox.x) }, diff_pixels: px, diff_ratio: +(px / (W * H)).toFixed(4), image: file });
		await page.close();
	}
}
await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.table(results.map((r) => ({ size: r.size, dir: r.dir, ref: `${r.reference.w}x${r.reference.h}`, ours: `${r.televixo.w}x${r.televixo.h}`, diff: r.diff_ratio })));
