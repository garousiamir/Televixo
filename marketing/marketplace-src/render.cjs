// Renders marketplace graphics to marketing/marketplace/.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'marketplace');
fs.mkdirSync(path.join(OUT, 'presentation'), { recursive: true });
const SLIDES = [['s1', '01-hero'], ['s2', '02-how-it-works'], ['s3', '03-reply-and-topics-mode'], ['s4', '04-team-inbox'], ['s5', '05-targeting'], ['s6', '06-design-and-languages'], ['s7', '07-reliability-and-security'], ['s8', '08-everything-included']];
(async () => {
  const b = await chromium.launch();
  const shot = async (hash, w, h, file, omitBackground = false) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + path.join(__dirname, 'assets.html') + '#' + hash);
    await p.evaluate(() => window.ready);
    await p.locator('#' + hash).screenshot({ path: file, omitBackground });
    await p.close();
  };
  await shot('icon', 512, 512, path.join(OUT, 'icon-512.png'), true);
  await shot('cover', 1180, 600, path.join(OUT, 'inline-preview-1180x600.png'));
  for (const [id, name] of SLIDES) await shot(id, 1920, 1080, path.join(OUT, 'presentation', name + '.png'));
  await b.close();
  const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
  ff('-i', path.join(OUT, 'icon-512.png'), '-vf', 'scale=80:80:flags=lanczos', path.join(OUT, 'thumbnail-80x80.png'));
  ff('-i', path.join(OUT, 'inline-preview-1180x600.png'), '-vf', 'scale=590:300:flags=lanczos', path.join(OUT, 'inline-preview-590x300.png'));
  ff('-i', path.join(OUT, 'inline-preview-1180x600.png'), '-vf', 'scale=590:300:flags=lanczos', '-q:v', '2', path.join(OUT, 'inline-preview-590x300.jpg'));
  for (const [, name] of SLIDES) ff('-i', path.join(OUT, 'presentation', name + '.png'), '-q:v', '2', path.join(OUT, 'presentation', name + '.jpg'));
  console.log('rendered');
})();
