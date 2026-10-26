// The design tokens must match the table in docs/design/README.md, the team's written source.
import { colors, fontSize, fonts, radius, size } from './tokens';

// Node modules through Jest, so the app keeps no Node types (it runs on React Native).
declare const __dirname: string;
const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: string): string;
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');
const README = readFileSync(join(__dirname, '../../../../../docs/design/README.md'), 'utf8');

function readmeColors(): Record<string, string> {
  const rows = README.matchAll(/^\| `color\.(\w+)` \| `(#[0-9A-Fa-f]{6})` \|/gm);
  return Object.fromEntries([...rows].map((m) => [m[1]!, m[2]!.toUpperCase()]));
}

describe('design tokens', () => {
  it('has every color of the README table with the same value', () => {
    const expected = readmeColors();
    expect(Object.keys(expected).length).toBe(24);
    for (const [name, value] of Object.entries(expected)) {
      expect({ name, value: colors[name as keyof typeof colors] }).toEqual({ name, value });
    }
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
