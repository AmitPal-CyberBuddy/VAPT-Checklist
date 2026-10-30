import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contrast contract.
 *
 * The design system claims "the lightest text token clears WCAG AA (4.5:1) on
 * both the app and panel surfaces" and that semantic steps "flip with the
 * theme" so labels pass in both. Those claims are arithmetic, so they are
 * tested as arithmetic: this file parses the shipped tokens out of
 * styles.css and computes the ratios for the pairings the components
 * actually render (badge chips are text on a *tinted* surface, segmented
 * labels sit on tinted glass, chip labels sit on solid fills).
 *
 * It exists because light mode failed quietly more than once: the inverting
 * ink scale makes `text-ink-950` near-white on paper, so dark-on-fill text
 * collapsed to ~3:1 in light mode while looking fine in dark. If a token
 * changes, this test — not a future audit — is what notices.
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
const primitives = readFileSync(join(ROOT, 'src/ui/primitives.tsx'), 'utf8');

type Palette = Record<string, string>;

function tokensIn(block: string): Palette {
  const out: Palette = {};
  for (const m of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const DARK = tokensIn(css.match(/@theme\s*\{([\s\S]*?)\n\}/)![1]);
const LIGHT: Palette = { ...DARK, ...tokensIn(css.match(/\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)![1]) };
const THEMES: [string, Palette][] = [
  ['dark', DARK],
  ['light', LIGHT],
];

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** A translucent layer (`bg-<token>/<alpha>`) composited over a surface. */
const over = (fg: string, bg: string, alpha: number): string => {
  const f = rgb(fg);
  const b = rgb(bg);
  return (
    '#' +
    f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
  );
};

const AA = 4.5;
const SURFACES = ['ink-950', 'ink-900', 'ink-850'] as const;

describe('text ramp clears WCAG AA on every surface', () => {
  it.each(THEMES)('%s theme: ink-100…500', (_name, pal) => {
    for (const tok of ['ink-100', 'ink-200', 'ink-300', 'ink-400', 'ink-500']) {
      for (const surface of SURFACES) {
        expect(ratio(pal[tok], pal[surface]), `${tok} on ${surface}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it.each(THEMES)('%s theme: semantic text steps', (_name, pal) => {
    // The steps components reach for when rendering coloured *text*
    // (TextLink, badge labels, status captions). 500-steps are fills and
    // graphics, not text, and are deliberately not held to this.
    for (const tok of ['brand-400', 'vuln-400', 'safe-400', 'high-300', 'medium-200', 'warn-300']) {
      for (const surface of SURFACES) {
        expect(ratio(pal[tok], pal[surface]), `${tok} on ${surface}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });
});

describe('badge chips (text on a tinted surface)', () => {
  // Parse BADGE_TONES out of primitives so the test tracks the components,
  // not a copy of them.
  const tones = [...primitives.matchAll(/(\w+):\s*'bg-([a-z0-9-]+)(?:\/(\d+))? text-([a-z0-9-]+)/g)].map(
    (m) => ({ tone: m[1], bg: m[2], alpha: m[3] ? Number(m[3]) / 100 : 1, text: m[4] }),
  );

  it('found the badge tones to check', () => {
    expect(tones.length).toBeGreaterThanOrEqual(10);
  });

  it.each(THEMES)('%s theme: every tone passes on the worst (inset) surface', (_name, pal) => {
    for (const { tone, bg, alpha, text } of tones) {
      const chip = over(pal[bg], pal['ink-850'], alpha);
      expect(ratio(pal[text], chip), `badge ${tone}: text-${text} on bg-${bg}/${alpha * 100}`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('segmented control (text on tinted glass)', () => {
  const segText = (klass: string, light: boolean): string => {
    const prefix = light ? String.raw`\[data-theme='light'\] ` : String.raw`^\s*`;
    const m = css.match(
      new RegExp(`${prefix}\\.${klass}\\s*\\{[^}]*?color:\\s*var\\(--color-([a-z0-9-]+)\\)`, 'm'),
    );
    return m![1];
  };
  const segTint = (klass: string, light: boolean): { color: string; alpha: number } => {
    const prefix = light ? String.raw`\[data-theme='light'\] ` : String.raw`^\s*`;
    const m = css.match(
      new RegExp(
        `${prefix}\\.${klass}\\s*\\{\\s*background:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([0-9.]+)\\)`,
        'm',
      ),
    )!;
    const hex =
      '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
    return { color: hex, alpha: Number(m[4]) };
  };

  it.each([
    ['dark', false],
    ['light', true],
  ] as const)('%s theme: active segment labels pass on their glass', (name, light) => {
    const pal = light ? LIGHT : DARK;
    for (const tone of ['brand', 'vuln', 'safe']) {
      const text = pal[segText(`text-seg-${tone}`, light)];
      const tint = segTint(`seg-on-${tone}`, light);
      // The control track sits on panels: ink-950/60 over ink-900. Ink-950
      // alone is the close-enough worst case in both themes.
      const glass = over(tint.color, pal['ink-950'], tint.alpha);
      expect(ratio(text, glass), `${name} seg-${tone}`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('text on solid fills', () => {
  it('on-fill ink passes on every saturated fill, both themes', () => {
    // Yes/Unknown answers, wizard step pills, the active-filter count.
    // `--color-on-fill` must stay constant across themes: the ink scale
    // inverts, so an ink-* token here is the bug this test guards.
    expect(DARK['on-fill']).toBeTruthy();
    expect(LIGHT['on-fill']).toBe(DARK['on-fill']);
    for (const [name, pal] of THEMES) {
      for (const fill of ['brand-500', 'safe-500', 'warn-500']) {
        expect(ratio(pal['on-fill'], pal[fill]), `${name}: on-fill on ${fill}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('primary button label passes in both themes', () => {
    // Dark: ink-950 over the gradient's darkest stop (brand-600) is the
    // worst point under the label. Light: white on solid brand-600.
    expect(ratio(DARK['ink-950'], DARK['brand-600'])).toBeGreaterThanOrEqual(AA);
    expect(ratio('#ffffff', LIGHT['brand-600'])).toBeGreaterThanOrEqual(AA);
  });

  it('danger button label passes at every gradient stop', () => {
    const block = css.match(/\.btn-danger\s*\{([\s\S]*?)\}/)![1];
    const stops = [...block.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
    expect(stops.length, 'danger gradient stops are hex (theme-constant by design)').toBeGreaterThanOrEqual(2);
    for (const stop of stops) {
      expect(ratio('#ffffff', stop), `white on danger stop ${stop}`).toBeGreaterThanOrEqual(AA);
    }
  });
});
