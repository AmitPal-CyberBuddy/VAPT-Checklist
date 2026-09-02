import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Design-system contract.
 *
 * ADR 0015 claims the visual language is enforced by the components rather than
 * by a style guide. These tests are the enforcement: they read the source and
 * fail the build when a screen drifts. Cheaper than a design review, and it
 * cannot be forgotten.
 */

const SRC = new URL('../', import.meta.url).pathname;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx$/.test(path) && !/\.test\.tsx$/.test(path)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path: path.replace(SRC, 'src/'),
  text: readFileSync(path, 'utf8'),
}));

const screens = FILES.filter((f) => !f.path.includes('src/ui/'));

function findAll(pattern: RegExp, files = FILES) {
  const hits: string[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(pattern)) {
      hits.push(`${file.path}: ${match[0]}`);
    }
  }
  return hits;
}

describe('typography scale', () => {
  it('uses only the seven defined steps', () => {
    const allowed = /^text-(micro|xs|sm|base|lg|xl|2xl)$/;
    const used = new Set(
      findAll(/\btext-(?:\[[^\]]+\]|micro|xs|sm|base|lg|xl|2xl|3xl|4xl)\b/g).map((h) =>
        h.split(': ')[1],
      ),
    );
    const offenders = [...used].filter((size) => !allowed.test(size));
    expect(offenders).toEqual([]);
  });

  it('never renders text below the 11px floor', () => {
    const tiny = findAll(/text-\[(?:[0-9]|10)px\]/g);
    expect(tiny).toEqual([]);
  });
});

describe('colour and shape', () => {
  it('uses semantic tokens, never raw palette hues, for status colour', () => {
    const raw = findAll(/\b(?:text|bg|border|ring|accent)-(?:rose|emerald|slate|gray|zinc|red|green)-\d{2,3}\b/g);
    expect(raw).toEqual([]);
  });

  it('uses the two defined radii', () => {
    const offenders = findAll(/\brounded-(?:xl|2xl|3xl)\b/g);
    expect(offenders).toEqual([]);
  });

  it('has no gradients, and no shadows outside toasts', () => {
    expect(findAll(/\bbg-gradient-|\bfrom-\[|\bvia-\[/g)).toEqual([]);
    expect(findAll(/\bshadow-(?:md|lg|xl|2xl)\b/g)).toEqual([]);
  });
});

describe('component reuse', () => {
  it('never hand-rolls a button — screens use Button, IconButton or LinkButton', () => {
    // A styled anchor/div imitating a button is how design systems rot.
    const offenders = findAll(/inline-flex[^"']*\bh-(?:8|9|11)\b[^"']*items-center/g, screens);
    expect(offenders).toEqual([]);
  });

  it('renders priority, status and result only through the badge components', () => {
    // Screens may reference the words, but must not restyle the states.
    const offenders = findAll(/tone=["']critical["']|tone=["']vulnerable["'][^>]*>\s*Vulnerable/g, screens)
      .filter((hit) => !hit.includes('DashboardPage'));
    expect(offenders).toEqual([]);
  });
});

describe('vocabulary', () => {
  const BANNED = [
    ['Pending', /\bPending\b/],
    ['Untested', /\bUntested\b/],
    ['Incomplete', /\bIncomplete\b/],
    ['Resolved', /\bResolved\b/],
    ['Findings', /\bFindings\b/],
    ['In scope', /\bIn scope\b/],
    ['Excluded', /\bExcluded\b/],
    ['Issue', /\bIssues?\b(?! that)/],
  ] as const;

  it.each(BANNED)('never shows "%s" in the interface', (_label, pattern) => {
    // Only user-visible strings matter, so scan JSX text and prop strings.
    const offenders: string[] = [];
    for (const file of screens) {
      for (const line of file.text.split('\n')) {
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
        if (pattern.test(line)) offenders.push(`${file.path}: ${line.trim().slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('accessibility contract', () => {
  it('labels every filter select', () => {
    const bare = findAll(/<Select\b(?![^>]*aria-label)/g, screens);
    expect(bare).toEqual([]);
  });

  it('gives every progress bar an accessible name', () => {
    const bars = findAll(/<ProgressBar\b/g, screens).length;
    const labelled = findAll(/<ProgressBar\b[\s\S]{0,200}?label=/g, screens).length;
    expect(labelled).toBe(bars);
  });

  it('keeps a single skip link and one main landmark', () => {
    const shell = FILES.find((f) => f.path.endsWith('AppShell.tsx'))!;
    expect(shell.text).toContain('Skip to main content');
    expect((shell.text.match(/<main\b/g) ?? []).length).toBe(1);
  });
});
