// The design tokens must match the table in docs/design/README.md, the team's written source.
import {
  darkColors,
  fontSize,
  fonts,
  lightColors,
  radius,
  shadows,
  size,
  type PaletteToken,
} from './tokens';

// Node modules through Jest, so the app keeps no Node types (it runs on React Native).
declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');
const README = readFileSync(join(__dirname, '../../../../../docs/design/README.md'), 'utf8');

/** Rows like | `color.divider` | `#EDF1F4` | `#22313D` | … | where "same" repeats the light value. */
function readmeColors(): Record<string, { light: string; dark: string }> {
  const rows = README.matchAll(
    /^\| `color\.(\w+)` \| `(#[0-9A-Fa-f]{6})` \| (?:`(#[0-9A-Fa-f]{6})`|same) \|/gm,
  );
  return Object.fromEntries(
    [...rows].map((m) => {
      const light = m[2]!.toUpperCase();
      return [m[1]!, { light, dark: (m[3] ?? light).toUpperCase() }];
    }),
  );
}

describe('design tokens', () => {
  const expected = readmeColors();

  it('reads every color row of the README table', () => {
    expect(Object.keys(expected).length).toBe(43);
  });

  it.each(Object.entries(expected))('%s has the README light and dark values', (name, value) => {
    const token = name as PaletteToken;
    expect({ light: lightColors[token], dark: darkColors[token] }).toEqual(value);
  });

  it('has the same keys in both palettes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('keeps everything drawn on blue the same in dark', () => {
    for (const token of [
      'primary',
      'primaryLight',
      'accent',
      'onPrimary',
      'onPrimaryMuted',
      'onPrimaryOverlay',
    ] as const) {
      expect(darkColors[token]).toBe(lightColors[token]);
    }
  });

  it('uses black ink shadows in dark and keeps the lime shadows', () => {
    expect(shadows.light.card.shadowColor).toBe('#0F2233');
    expect(shadows.dark.card.shadowColor).toBe('#000000');
    expect(shadows.dark.card.shadowOpacity).toBe(shadows.light.card.shadowOpacity);
    expect(shadows.dark.tabBar).toEqual(shadows.light.tabBar);
  });

  it('has the README font sizes', () => {
    for (const s of [10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 26, 28, 34]) {
      expect(fontSize[s as keyof typeof fontSize]).toBe(s);
    }
  });

  it('has the README radii and sizes', () => {
    expect(radius).toMatchObject({ pill: 999, card: 18, button: 16, input: 14, sheet: 32 });
    expect(size).toMatchObject({
      screenWidth: 390,
      screenHeight: 844,
      buttonPrimary: 56,
      buttonSecondary: 52,
      iconButton: 48,
      backButton: 44,
    });
  });

  it('uses one font family per design weight', () => {
    expect(Object.keys(fonts.body)).toEqual(['regular', 'medium', 'semibold', 'bold']);
    expect(Object.keys(fonts.heading)).toEqual(['medium', 'bold']);
    expect(Object.keys(fonts.amount)).toEqual(['medium', 'semibold']);
  });
});
