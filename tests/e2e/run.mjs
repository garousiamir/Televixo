// Browser E2E against a real WordPress site with the plugin and the E2E
// fake-Telegram MU-plugin. Usage: BASE=http://127.0.0.1:8899 node tests/e2e/run.mjs
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.env.BASE || 'http://127.0.0.1:8899';
const WP = process.env.WP_CLI || '/tmp/claude-0/bin/wp';
const SITE = process.env.WP_PATH || '/tmp/claude-0/env/site';
const SHOTS = join(root, 'docs/screenshots');
mkdirSync(SHOTS, { recursive: true });

const wp = (...args) => execFileSync(WP, [`--path=${SITE}`, ...args], { encoding: 'utf8' }).trim();
const seed = () => wp('eval-file', join(root, 'tests/e2e/seed.php'));
const worker = () => fetch(`${BASE}/wp-json/tvx-e2e/v1/worker`, { method: 'POST' }).then((r) => r.json());
const calls = () => fetch(`${BASE}/wp-json/tvx-e2e/v1/calls`).then((r) => r.json());
let updateId = 50000;
const operatorReply = (text, replyTo, from = 777) => fetch(`${BASE}/wp-json/televixo/v1/telegram/webhook`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'e2e-secret-123' },
	body: JSON.stringify({ update_id: ++updateId, message: { message_id: 90000 + updateId, from: { id: from, is_bot: false, first_name: 'Clara' }, chat: { id: -1001000000001, type: 'supergroup' }, date: Math.floor(Date.now() / 1000), text, reply_to_message: { message_id: replyTo } } }),
});

let browser;
before(async () => { seed(); browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const shadow = (page) => page.locator('#televixo-root');
const W = (page, sel) => page.locator(`#televixo-root >> css=${sel}`);

async function openWidget(page) {
	await W(page, '.tvx-launcher').click();
	await W(page, '#tvx-panel').waitFor({ state: 'visible' });
}

async function lastSentText() {
	const c = (await calls()).filter((x) => x.method === 'sendMessage');
	return c[c.length - 1];
}

test('visitor ↔ Telegram operator round trip, refresh persistence, unread badge', async () => {
	seed();
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	await page.goto(BASE + '/about/');
	await openWidget(page);
	await W(page, '#tvx-input').fill('Hello <b>team</b>, which size am I?');
	await W(page, '#tvx-input').press('Enter');
	await W(page, '.tvx-msg--me .tvx-state').filter({ hasText: 'Sent' }).waitFor();
	// Telegram is contacted by the worker, not inside the visitor request.
	await worker();
	const sent = await lastSentText();
	assert.match(sent.params.text, /Hello <b>team<\/b>, which size am I\?/);
	assert.match(sent.params.text, /\/about/);
	assert.equal(sent.params.parse_mode, undefined);
	const sentId = (await calls()).filter((x) => x.method === 'sendMessage').length ? Number(wp('option', 'get', 'tvx_e2e_next')) : 0;
	// Operator replies in Telegram (via the authenticated webhook).
	const r = await operatorReply('You are a medium 😊', sentId);
	assert.equal(r.status, 200);
	await worker();
	await W(page, '.tvx-msg--them .tvx-text').filter({ hasText: 'You are a medium' }).waitFor({ timeout: 15000 });
	await page.screenshot({ path: join(SHOTS, 'e2e-roundtrip-desktop.png') });

	// Refresh: history is restored from the HttpOnly session.
	await page.reload();
	await openWidget(page);
	await W(page, '.tvx-text').filter({ hasText: 'You are a medium' }).waitFor({ timeout: 10000 });

	// Close panel, operator replies again → unread badge.
	await page.keyboard.press('Escape');
	await operatorReply('Anything else?', sentId);
	await worker();
	await W(page, '.tvx-launcher__badge').filter({ hasText: '1' }).waitFor({ timeout: 25000 });
	await W(page, '.tvx-teaser__text').filter({ hasText: 'Anything else?' }).waitFor();
	assert.deepEqual(errors, []);
	await ctx.close();
});

test('two tabs stay consistent and cursor dedup prevents duplicates', async () => {
	seed();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const a = await ctx.newPage();
	await a.goto(BASE + '/about/');
	await openWidget(a);
	await W(a, '#tvx-input').fill('multi tab hello');
	await W(a, '#tvx-input').press('Enter');
	await W(a, '.tvx-msg--me .tvx-state').filter({ hasText: 'Sent' }).waitFor();
	await worker();
	const b = await ctx.newPage();
	await b.goto(BASE + '/about/');
	await openWidget(b);
	await W(b, '.tvx-text').filter({ hasText: 'multi tab hello' }).waitFor({ timeout: 10000 });
	await operatorReply('reply for both tabs', Number(wp('option', 'get', 'tvx_e2e_next')));
	await worker();
	for (const p of [a, b]) {
		await p.bringToFront();
		await W(p, '.tvx-text').filter({ hasText: 'reply for both tabs' }).waitFor({ timeout: 20000 });
		assert.equal(await W(p, '.tvx-text').filter({ hasText: 'reply for both tabs' }).count(), 1, 'no duplicate after relays/polls');
	}
	await ctx.close();
});

test('keyboard: open, focus, escape returns focus to launcher; axe has no serious violations', async () => {
	seed();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	await page.goto(BASE + '/about/');
	await W(page, '.tvx-launcher').waitFor();
	await W(page, '.tvx-launcher').focus();
	await page.keyboard.press('Enter');
	await W(page, '#tvx-panel').waitFor({ state: 'visible' });
	await page.waitForTimeout(300);
	const active = await page.evaluate(() => document.querySelector('#televixo-root').shadowRoot.activeElement?.id);
	assert.equal(active, 'tvx-input');
	await page.keyboard.press('Escape');
	const back = await page.evaluate(() => document.querySelector('#televixo-root').shadowRoot.activeElement?.className);
	assert.match(back, /tvx-launcher/);
	await page.keyboard.press('Enter');
	await W(page, '#tvx-panel').waitFor({ state: 'visible' });
	await page.waitForTimeout(500); // let the 200 ms fade-in finish before measuring contrast
	await page.addScriptTag({ path: join(root, 'node_modules/axe-core/axe.min.js') });
	const res = await page.evaluate(async () => (window).axe.run('#televixo-root', { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }));
	const serious = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
	writeFileSync(join(root, 'docs/axe-widget.json'), JSON.stringify({ violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), passes: res.passes.length }, null, 2));
	assert.deepEqual(serious.map((v) => v.id), []);
	await ctx.close();
});

test('pricing rule: shows once after 15 visible seconds, persists across refresh/navigation', async () => {
	seed();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	await page.goto(BASE + '/pricing/');
	await W(page, '.tvx-launcher').waitFor();
	await page.waitForTimeout(10000);
	assert.equal(await W(page, '.tvx-teaser').isVisible(), false, 'not before 15 s');
	await W(page, '.tvx-teaser__text').filter({ hasText: 'Questions about our plans' }).waitFor({ timeout: 9000 });
	await page.screenshot({ path: join(SHOTS, 'e2e-pricing-teaser.png') });
	await page.reload();
	await page.waitForTimeout(17000);
	assert.equal(await W(page, '.tvx-teaser').isVisible(), false, 'not again within 24h after refresh');
	await page.goto(BASE + '/about/');
	await page.goto(BASE + '/pricing/');
	await page.waitForTimeout(16500);
	assert.equal(await W(page, '.tvx-teaser').isVisible(), false, 'not again after navigation');
	await ctx.close();
});

test('excluded pages load no widget code; page HTML is identical across visitors (cache-safe)', async () => {
	const a = await (await fetch(BASE + '/no-chat/')).text();
	assert.equal(a.includes('televixo-widget'), false);
	const ctx1 = await browser.newContext();
	const p1 = await ctx1.newPage();
	await p1.goto(BASE + '/about/');
	await openWidget(p1);
	await p1.waitForTimeout(800);
	const cookies = await ctx1.cookies();
	const session = cookies.find((c) => c.name === 'televixo_session');
	assert.ok(session && session.httpOnly, 'HttpOnly session cookie');
	const withCookie = await (await fetch(BASE + '/about/', { headers: { Cookie: `televixo_session=${session.value}` } })).text();
	const without = await (await fetch(BASE + '/about/')).text();
	assert.equal(withCookie, without, 'user-specific state never appears in page HTML');
	assert.equal(withCookie.includes(session.value), false);
	await ctx1.close();
});

test('mobile and RTL (fa_IR) rendering', async () => {
	seed();
	for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }]]) {
		const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: name === 'mobile' });
		const page = await ctx.newPage();
		await page.goto(BASE + '/about/');
		await openWidget(page);
		const box = await W(page, '#tvx-panel').boundingBox();
		assert.ok(box.width <= vp.width, 'panel fits viewport');
		await page.screenshot({ path: join(SHOTS, `e2e-${name}-ltr.png`) });
		await ctx.close();
	}
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	await page.goto(BASE + '/about/?tvx_locale=fa_IR');
	await ctx.addCookies([{ name: 'tvx_locale', value: 'fa_IR', url: BASE }]);
	await openWidget(page);
	const dir = await page.evaluate(() => document.querySelector('#televixo-root').shadowRoot.querySelector('.tvx').getAttribute('dir'));
	assert.equal(dir, 'rtl');
	assert.equal(await W(page, '.tvx-send').innerText(), 'ارسال');
	const pos = await W(page, '.tvx-launcher').boundingBox();
	assert.ok(pos.x < 200, 'logical end = left side in RTL');
	await W(page, '#tvx-input').fill('سلام، سفارش من کجاست؟');
	await W(page, '#tvx-input').press('Enter');
	await W(page, '.tvx-msg--me .tvx-text').filter({ hasText: 'سلام' }).waitFor();
	await page.screenshot({ path: join(SHOTS, 'e2e-desktop-rtl-fa.png') });
	await ctx.close();
});

test('admin inbox: operator sees the conversation and replies; visitor receives it', async () => {
	seed();
	const vctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const v = await vctx.newPage();
	await v.goto(BASE + '/about/');
	await openWidget(v);
	await W(v, '#tvx-input').fill('Question from the website');
	await W(v, '#tvx-input').press('Enter');
	await W(v, '.tvx-msg--me .tvx-state').filter({ hasText: 'Sent' }).waitFor();

	const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const a = await actx.newPage();
	const errors = [];
	a.on('pageerror', (e) => errors.push(String(e)));
	await a.goto(BASE + '/wp-login.php');
	await a.fill('#user_login', 'admin');
	await a.fill('#user_pass', 'admin');
	await a.click('#wp-submit');
	await a.goto(BASE + '/wp-admin/admin.php?page=televixo');
	await a.locator('.tvxa-conv').first().waitFor({ timeout: 15000 });
	await a.locator('.tvxa-conv').first().click();
	await a.locator('.tvxa-bubble').filter({ hasText: 'Question from the website' }).waitFor();
	await a.locator('.tvxa-composer textarea').fill('Answer from the WordPress inbox');
	await a.locator('.tvxa-composer button', { hasText: 'Send' }).click();
	await a.locator('.tvxa-bubble').filter({ hasText: 'Answer from the WordPress inbox' }).waitFor({ timeout: 10000 });
	await a.screenshot({ path: join(SHOTS, 'admin-inbox.png'), fullPage: false });
	await W(v, '.tvx-text').filter({ hasText: 'Answer from the WordPress inbox' }).waitFor({ timeout: 15000 });
	// The inbox reply is mirrored to Telegram.
	await worker();
	assert.match((await lastSentText()).params.text, /Answer from the WordPress inbox/);
	for (const [slug, file] of [['televixo-setup', 'admin-setup'], ['televixo-appearance', 'admin-appearance'], ['televixo-rules', 'admin-rules'], ['televixo-reports', 'admin-reports'], ['televixo-queue', 'admin-queue'], ['televixo-settings', 'admin-settings'], ['televixo-operators', 'admin-operators'], ['televixo-content', 'admin-content']]) {
		await a.goto(`${BASE}/wp-admin/admin.php?page=${slug}`);
		await a.locator('.tvxa-top h1').waitFor({ timeout: 15000 });
		await a.waitForTimeout(slug === 'televixo-appearance' ? 1500 : 600);
		await a.screenshot({ path: join(SHOTS, `${file}.png`), fullPage: false });
	}
	assert.deepEqual(errors, []);
	await vctx.close();
	await actx.close();
});

test('unauthorized Telegram sender and forged webhook are rejected end to end', async () => {
	seed();
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(BASE + '/about/');
	await openWidget(page);
	await W(page, '#tvx-input').fill('secret question');
	await W(page, '#tvx-input').press('Enter');
	await W(page, '.tvx-msg--me .tvx-state').filter({ hasText: 'Sent' }).waitFor();
	await worker();
	const target = Number(wp('option', 'get', 'tvx_e2e_next'));
	const forged = await fetch(`${BASE}/wp-json/televixo/v1/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'guess' }, body: JSON.stringify({ update_id: 1, message: {} }) });
	assert.equal(forged.status, 403);
	await operatorReply('I am not an operator', target, 31337);
	await worker();
	await page.waitForTimeout(4000);
	assert.equal(await W(page, '.tvx-text').filter({ hasText: 'I am not an operator' }).count(), 0);
	await ctx.close();
});
