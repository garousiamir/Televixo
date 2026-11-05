// Renders selected timestamps to PNGs and a contact sheet: node preview.js 1.2 5 10 ...
const { chromium } = require('playwright');
const path = require('path');
const { execFileSync } = require('child_process');
(async () => {
  const times = process.argv.slice(2).map(Number);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(process.env.W || 1920), height: Number(process.env.H || 1080) } });
  await p.goto('file://' + path.join(__dirname, process.env.PAGE || "pricing.html"));
  await p.evaluate(() => window.ready);
  await p.waitForTimeout(500);
  const files = [];
  for (const t of times) {
    await p.evaluate((t) => window.render(t), t);
    const f = path.join(__dirname, 'build', `prev-${t.toFixed(2)}.png`);
    await p.screenshot({ path: f });
    files.push(f);
  }
  await b.close();
  const vert = (process.env.H || 1080) > (process.env.W || 1920), TW = vert ? 270 : 640, TH = vert ? 480 : 360, cols = vert ? 5 : 3, inputs = files.flatMap((f) => ['-i', f]);
  const rows = Math.ceil(files.length / cols);
  const layout = files.map((_, i) => `${(i % cols) * TW}_${Math.floor(i / cols) * TH}`).join('|');
  const scale = files.map((_, i) => `[${i}:v]scale=${TW}:${TH}[v${i}]`).join(';');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scale};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}:fill=black`, path.join(__dirname, 'build', 'sheet.png')]);
  console.log('sheet ok');
})();
