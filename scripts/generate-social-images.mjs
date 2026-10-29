/**
 * Regenerates the social/brand raster images in public/:
 *   og-card.png          1200×630 Open Graph / Twitter card (scripts/og-card.svg)
 *   apple-touch-icon.png 180×180 from public/favicon.svg (iOS ignores SVG icons)
 *
 * Run after changing the brand mark, the product name, or scripts/og-card.svg.
 * Numbers that can drift (test counts…) are deliberately not on the card.
 *
 * Prerequisites (one-off tooling, intentionally not in package.json):
 *   npm i -D @resvg/resvg-js          # SVG → PNG renderer
 *   pip install fonttools brotli      # woff2 → ttf for the renderer
 *   node scripts/generate-social-images.mjs --fonts-only   # writes scripts/fonts/
 *   node scripts/generate-social-images.mjs
 *
 * If @resvg/resvg-js lives outside this repo, set OG_TOOLS_DIR to its
 * node_modules parent.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'scripts', 'fonts');

function makeFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  const inter = join(ROOT, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
  const jb = (w) => join(ROOT, `node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${w}-normal.woff2`);
  for (const [src, name] of [[inter, 'inter-var'], [jb(400), 'jb-400'], [jb(600), 'jb-600']]) {
    copyFileSync(src, join(FONT_DIR, `${name}.woff2`));
    execFileSync('python3', ['-m', 'fontTools.ttLib.woff2', 'decompress', join(FONT_DIR, `${name}.woff2`)], { stdio: 'inherit' });
  }
  for (const w of [400, 600, 700]) {
    execFileSync('python3', ['-m', 'fontTools.varLib.instancer', join(FONT_DIR, 'inter-var.ttf'), `wght=${w}`, '-o', join(FONT_DIR, `inter-${w}.ttf`)], { stdio: 'inherit' });
  }
  console.log(`Fonts written to ${FONT_DIR}`);
}

if (process.argv.includes('--fonts-only')) {
  makeFonts();
  process.exit(0);
}

let Resvg;
try {
  ({ Resvg } = createRequire(import.meta.url)('@resvg/resvg-js'));
} catch {
  const alt = process.env.OG_TOOLS_DIR;
  if (!alt) {
    console.error('Missing @resvg/resvg-js. Install it here (npm i -D @resvg/resvg-js) or set OG_TOOLS_DIR.');
    process.exit(1);
  }
  ({ Resvg } = createRequire(join(alt, 'noop.js'))('@resvg/resvg-js'));
}

const fontFiles = existsSync(FONT_DIR)
  ? readdirSync(FONT_DIR).filter((f) => /^(inter-\d+|jb-\d+)\.ttf$/.test(f)).map((f) => join(FONT_DIR, f))
  : [];
if (fontFiles.length === 0) {
  console.error(`No TTFs in ${FONT_DIR}. Run with --fonts-only first (needs python fonttools + brotli).`);
  process.exit(1);
}
const font = { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' };

function render(svgPath, outPath, width) {
  const svg = readFileSync(svgPath, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font }).render().asPng();
  writeFileSync(outPath, png);
  console.log(`${outPath.replace(ROOT, '.')}  (${(png.byteLength / 1024).toFixed(0)} kB)`);
}

render(join(ROOT, 'scripts/og-card.svg'), join(ROOT, 'public/og-card.png'), 1200);
render(join(ROOT, 'public/favicon.svg'), join(ROOT, 'public/apple-touch-icon.png'), 180);
