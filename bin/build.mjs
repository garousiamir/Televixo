/**
 * Reproducible asset build. Node is only needed at build time; the
 * installed plugin ships compiled files in televixo/assets/build/.
 *
 *   npm ci && npm run build
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'televixo/assets/build');
const dev = process.argv.includes('--dev');
mkdirSync(join(out, 'fonts'), { recursive: true });

const hash = (files) => createHash('sha256').update(files.map((f) => readFileSync(f)).join('')).digest('hex').slice(0, 12);

function assetPhp(name, deps, files) {
	const php = `<?php return array( 'dependencies' => array( ${deps.map((d) => `'${d}'`).join(', ')} ), 'version' => '${hash(files)}' );\n`;
	writeFileSync(join(out, `${name}.asset.php`), php);
}

/** Maps @wordpress/* imports to the globals WordPress core provides. */
const wpExternals = {
	name: 'wp-externals',
	setup(b) {
		const used = new Set();
		b.onResolve({ filter: /^@wordpress\/|^react(-dom)?(\/jsx-runtime)?$/ }, (args) => ({ path: args.path, namespace: 'wp-global' }));
		b.onLoad({ filter: /.*/, namespace: 'wp-global' }, (args) => {
			const p = args.path;
			let global, handle;
			if (p === 'react' || p === 'react/jsx-runtime') { global = 'React'; handle = 'react'; }
			else if (p === 'react-dom') { global = 'ReactDOM'; handle = 'react-dom'; }
			else if (p === '@wordpress/element/jsx-runtime') { global = 'wp.element'; handle = 'wp-element'; }
			else {
				const name = p.replace('@wordpress/', '');
				global = 'wp.' + name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
				handle = 'wp-' + name;
			}
			used.add(handle);
			b.initialOptions.metafile = true;
			b._wpDeps = used;
			if (p.endsWith('jsx-runtime')) {
				return { contents: `const e = window.wp.element; export const jsx = (t, p, k) => e.createElement(t, k === undefined ? p : { ...p, key: k }); export const jsxs = jsx; export const Fragment = e.Fragment;`, loader: 'js' };
			}
			return { contents: `module.exports = window.${global};`, loader: 'js' };
		});
		b.onEnd(() => { b._done = [...used]; });
	},
};

const common = { bundle: true, minify: !dev, sourcemap: dev ? 'inline' : false, target: ['es2019', 'chrome80', 'firefox78', 'safari13'], legalComments: 'none', logLevel: 'warning' };

await build({ ...common, entryPoints: [join(root, 'assets-src/widget/index.ts')], outfile: join(out, 'widget.js'), format: 'iife' });
await build({ ...common, entryPoints: [join(root, 'assets-src/widget/styles.css')], outfile: join(out, 'widget.css'), loader: { '.css': 'css' } });
assetPhp('widget', [], [join(out, 'widget.js'), join(out, 'widget.css')]);

const fonts = [
	['@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff2', 'hanken-grotesk-latin-400.woff2'],
	['@fontsource/hanken-grotesk/files/hanken-grotesk-latin-500-normal.woff2', 'hanken-grotesk-latin-500.woff2'],
	['@fontsource/hanken-grotesk/files/hanken-grotesk-latin-ext-400-normal.woff2', 'hanken-grotesk-latin-ext-400.woff2'],
	['@fontsource/hanken-grotesk/files/hanken-grotesk-latin-ext-500-normal.woff2', 'hanken-grotesk-latin-ext-500.woff2'],
	['@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2', 'vazirmatn-arabic-400.woff2'],
	['@fontsource/vazirmatn/files/vazirmatn-arabic-500-normal.woff2', 'vazirmatn-arabic-500.woff2'],
];
for (const [src, dst] of fonts) copyFileSync(join(root, 'node_modules', src), join(out, 'fonts', dst));
copyFileSync(join(root, 'node_modules/@fontsource/hanken-grotesk/LICENSE'), join(out, 'fonts', 'OFL-HankenGrotesk.txt'));
copyFileSync(join(root, 'node_modules/@fontsource/vazirmatn/LICENSE'), join(out, 'fonts', 'OFL-Vazirmatn.txt'));

const adminEntry = join(root, 'assets-src/admin/index.tsx');
if (existsSync(adminEntry)) {
	const plugin = { ...wpExternals };
	let deps = [];
	plugin.setup = (b) => { wpExternals.setup(b); b.onEnd(() => { deps = b._done || []; }); };
	await build({ ...common, entryPoints: [adminEntry], outfile: join(out, 'admin.js'), format: 'iife', jsx: 'automatic', jsxImportSource: '@wordpress/element', plugins: [plugin] });
	await build({ ...common, entryPoints: [join(root, 'assets-src/admin/admin.css')], outfile: join(out, 'admin.css'), loader: { '.css': 'css' } });
	assetPhp('admin', [...new Set(['wp-element', 'wp-api-fetch', 'wp-i18n', ...deps])].filter((d) => d !== 'wp-element/jsx-runtime'), [join(out, 'admin.js'), join(out, 'admin.css')]);
}

const report = {};
for (const f of ['widget.js', 'widget.css', 'admin.js', 'admin.css']) {
	const p = join(out, f);
	if (existsSync(p)) { const b = readFileSync(p); report[f] = { bytes: b.length, gzip: gzipSync(b).length }; }
}
writeFileSync(join(root, 'docs/asset-budget.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report);
