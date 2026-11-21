// Tests for scripts/design-color-pairs.mjs. Run with `node --test scripts/` (part of `make test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colorsIn, formatPairs, normalizeColor, pairColors } from './design-color-pairs.mjs';

test('normalizeColor lowercases, expands short hex and writes leading zeros', () => {
  assert.equal(normalizeColor('#FFF'), '#ffffff');
  assert.equal(normalizeColor('#2FA8D8'), '#2fa8d8');
  assert.equal(normalizeColor('rgba(15, 34, 51, .25)'), 'rgba(15,34,51,0.25)');
});

test('colorsIn keeps the order of the markup', () => {
  const html = '<body style="background:#ffffff;color:#0f2233"><b style="color:rgba(0,0,0,.2)">';
  assert.deepEqual(colorsIn(html), ['#ffffff', '#0f2233', 'rgba(0,0,0,0.2)']);
});

test('pairColors pairs by position and counts each dark value', () => {
  const { pairs, skipped } = pairColors([
    { name: 'A', light: '#ffffff #0f2233 #ffffff', dark: '#13212d #e8f1f6 #ffffff' },
    { name: 'B', light: '#ffffff', dark: '#13212d' },
  ]);
  assert.deepEqual(skipped, []);
  assert.deepEqual(
    [...pairs.get('#ffffff').entries()],
    [
      ['#13212d', 2],
      ['#ffffff', 1],
    ],
  );
  assert.deepEqual([...pairs.get('#0f2233').entries()], [['#e8f1f6', 1]]);
});

test('pairColors skips a screen whose files have a different number of colors', () => {
  const { pairs, skipped } = pairColors([{ name: 'C', light: '#ffffff #000000', dark: '#13212d' }]);
  assert.equal(pairs.size, 0);
  assert.deepEqual(skipped, [{ name: 'C', light: 2, dark: 1 }]);
});

test('formatPairs filters one color and lists skipped screens', () => {
  const result = pairColors([
    { name: 'A', light: '#ffffff #0f2233', dark: '#13212d #e8f1f6' },
    { name: 'C', light: '#ffffff', dark: '' },
  ]);
  const out = formatPairs(result, '#0f2233');
  assert.match(out, /#0f2233\s+-> #e8f1f6 \(1\)/);
  assert.doesNotMatch(out, /#ffffff\s+->/);
  assert.match(out, /C: 1 light, 0 dark/);
});
