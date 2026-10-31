// Runs the shared rule vectors through the widget's TypeScript evaluator.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'tvx-'));
await build({ entryPoints: [join(root, 'assets-src/widget/rules.ts'), join(root, 'assets-src/widget/i18n.ts')], outdir: dir, format: 'esm', bundle: false, outExtension: { '.js': '.mjs' }, logLevel: 'error' });
const rules = await import(pathToFileURL(join(dir, 'rules.mjs')));
const i18n = await import(pathToFileURL(join(dir, 'i18n.mjs')));
const fx = (n) => JSON.parse(readFileSync(join(root, 'tests/fixtures', n), 'utf8'));

// The PHP side validates definitions; the vectors are already valid, so
// normalise defaults the validator would add.
const norm = (d) => ({ exclusions: null, frequency: {}, stop: {}, ...d, conditions: { negate: false, ...d.conditions } });

test('shared rule vectors match PHP expectations', () => {
	let n = 0;
	for (const v of fx('rule-vectors.json')) {
		v.cases.forEach((c, i) => {
			assert.equal(rules.evaluate(norm(v.definition), c.ctx, v.id).matched, c.expected, `${v.name} case ${i}`);
			n++;
		});
	}
	assert.ok(n > 20);
});

test('resolution precedence matches PHP', () => {
	const f = fx('rule-resolution.json');
	const list = f.rules.map((r) => ({ ...r, definition: norm(r.definition) }));
	for (const c of f.cases) {
		const res = rules.resolve(list, c.ctx);
		const att = res.actions.attention;
		assert.equal(att ? att.type + (att.text ? ':' + att.text : '') : null, c.expected.attention);
		assert.equal(res.actions.launcher ? res.actions.launcher.visible !== false : true, c.expected.launcher);
		assert.equal(res.actions.greeting?.text ?? null, c.expected.greeting);
		assert.deepEqual(res.matched, c.expected.matched);
	}
});

test('wildcard never interprets regex syntax', () => {
	assert.equal(rules.wildcard('/a.b', '/aXb'), false);
	assert.equal(rules.wildcard('/(x|y)', '/x'), false);
	assert.equal(rules.wildcard('/p*', '/pricing/pro'), true);
});

test('plural expressions (gettext) evaluate safely', () => {
	const ru = i18n.compilePlural('(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)');
	assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map(ru), [0, 1, 2, 2, 0, 1, 2]);
	const fa = i18n.compilePlural('n > 1');
	assert.deepEqual([0, 1, 2].map(fa), [0, 0, 1]);
	const bad = i18n.compilePlural('alert(1)');
	assert.deepEqual([1, 2].map(bad), [0, 1], 'invalid expressions fall back to English rules');
	const t = new i18n.I18n({ s: { opens_at: 'Opens %s' }, p: { unread: ['%d new message', '%d new messages'] }, plural: 'n != 1' });
	assert.equal(t.n('unread', 1), '1 new message');
	assert.equal(t.n('unread', 3), '3 new messages');
	assert.equal(t.t('opens_at', 'Mon 9:00'), 'Opens Mon 9:00');
});
