#!/usr/bin/env node
// Prints the dark value of every light color in the design (owned by M0).
//
// docs/design/sources/light/<Screen>.html and docs/design/sources/dark/<Screen>.html have the
// same markup and differ only in colors. This script reads both files of each screen, takes the
// colors in the order they appear, and pairs them by position. A light color can map to more
// than one dark color when it plays two roles (white is a surface and also text on blue), so
// every dark value is listed with how many times it appears.
//
// Screens whose two files have a different number of colors cannot be paired by position. They
// are listed at the end and left out.
//
// Usage:
//   node scripts/design-color-pairs.mjs                 every color, most used first
//   node scripts/design-color-pairs.mjs '#e4f5fc'       one light color
//   node scripts/design-color-pairs.mjs --screen Metas  one screen
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLOR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g;

/** Lowercase, no spaces, `#abc` expanded to `#aabbcc`, `.5` written as `0.5`. */
export function normalizeColor(value) {
  let c = value.toLowerCase().replace(/\s+/g, '');
  if (/^#[0-9a-f]{3}$/.test(c)) c = `#${[...c.slice(1)].map((d) => d + d).join('')}`;
  return c.replace(/([(,])\./g, '$10.');
}

export function colorsIn(html) {
  return (html.match(COLOR) ?? []).map(normalizeColor);
}

/**
 * Pairs the colors of each screen. `screens` is a list of `{ name, light, dark }` HTML strings.
 * Returns `{ pairs: Map<light, Map<dark, count>>, skipped: [{ name, light, dark }] }`.
 */
export function pairColors(screens) {
  const pairs = new Map();
  const skipped = [];
  for (const { name, light, dark } of screens) {
    const l = colorsIn(light);
    const d = colorsIn(dark);
    if (l.length !== d.length) {
      skipped.push({ name, light: l.length, dark: d.length });
      continue;
    }
    l.forEach((lc, i) => {
      const row = pairs.get(lc) ?? new Map();
      row.set(d[i], (row.get(d[i]) ?? 0) + 1);
      pairs.set(lc, row);
    });
  }
  return { pairs, skipped };
}

function total(row) {
  let n = 0;
  for (const c of row.values()) n += c;
  return n;
}

export function formatPairs({ pairs, skipped }, only) {
  const lines = [];
  const rows = [...pairs.entries()]
    .filter(([light]) => !only || light === only)
    .sort((a, b) => total(b[1]) - total(a[1]));
  for (const [light, row] of rows) {
    const darks = [...row.entries()].sort((a, b) => b[1] - a[1]);
    const list = darks.map(([dark, n]) => `${dark} (${n})`).join(', ');
    lines.push(`${String(total(row)).padStart(5)}  ${light.padEnd(24)} -> ${list}`);
  }
  if (rows.length === 0)
    lines.push(only ? `${only} does not appear in the light files.` : 'No colors.');
  if (skipped.length > 0) {
    lines.push('', 'Not paired (different number of colors in light and dark):');
    for (const s of skipped) lines.push(`  ${s.name}: ${s.light} light, ${s.dark} dark`);
  }
  return lines.join('\n');
}

function readScreens(dir, screen) {
  return readdirSync(join(dir, 'light'))
    .filter((f) => f.endsWith('.html'))
    .filter((f) => !screen || f === `${screen}.html`)
    .map((f) => ({
      name: f.replace(/\.html$/, ''),
      light: readFileSync(join(dir, 'light', f), 'utf8'),
      dark: readFileSync(join(dir, 'dark', f), 'utf8'),
    }));
}

function main(argv) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..');
  const dir = join(root, 'docs', 'design', 'sources');
  const screenAt = argv.indexOf('--screen');
  const screen = screenAt >= 0 ? argv[screenAt + 1] : undefined;
  const isScreenName = (i) => screenAt >= 0 && i === screenAt + 1;
  const color = argv.find((a, i) => !a.startsWith('--') && !isScreenName(i));
  const screens = readScreens(dir, screen);
  if (screens.length === 0) {
    console.error(screen ? `No screen named ${screen} in ${dir}` : `No screens in ${dir}`);
    process.exit(1);
  }
  console.log(formatPairs(pairColors(screens), color && normalizeColor(color)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
