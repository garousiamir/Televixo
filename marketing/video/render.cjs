// Deterministic frame-by-frame render piped into ffmpeg, then muxed with the soundtrack.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const tl = require('./timeline.json');
(async () => {
  const fps = Number(process.env.FPS || tl.fps), dur = Number(process.env.DUR || tl.duration);
  const out = path.join(__dirname, 'build', process.env.OUT || 'video-only.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Number(process.env.W || 1920), height: Number(process.env.H || 1080) } });
  await p.goto('file://' + path.join(__dirname, process.env.PAGE || 'index.html'));
  await p.evaluate(() => window.ready);
  await p.waitForTimeout(800);
  const total = Math.round(fps * dur), t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await p.evaluate((t) => window.render(t), i / fps);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log('video done');
})();
