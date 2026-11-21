// The Aviso illustration: the design colors of each theme, and still with reduced motion.
import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemeProvider } from '@shared/ui';

import { IntroIllustration } from './IntroIllustration';
import { onboardingStrings } from './strings.es-CO';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<{ default: unknown }>('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});

const reduceMotion = useReducedMotion as jest.Mock;
const noStore = { load: async () => 'light' as const, save: async () => {} };
// react-native-svg hands fills to the native side as opaque ARGB numbers.
const fills = () => JSON.stringify(screen.toJSON());
const argb = (hex: string) => `"payload":${0xff000000 + parseInt(hex.slice(1), 16)}`;

async function draw(scheme: 'light' | 'dark') {
  await render(
    <ThemeProvider initialPreference={scheme} store={noStore}>
      <IntroIllustration />
    </ThemeProvider>,
  );
}

describe('IntroIllustration', () => {
  it('is one image with the design description', async () => {
    await draw('light');
    expect(screen.getByRole('image', { name: onboardingStrings.intro.illustration })).toBeTruthy();
  });

  it.each([
    ['light', ['#e4f5fc', '#e8eef2', '#edf1f4'], ['#1a3444', '#22313d']],
    ['dark', ['#1a3444', '#22313d'], ['#e4f5fc', '#e8eef2', '#edf1f4']],
  ] as const)('draws the %s pill and empty bars', async (scheme, has, lacks) => {
    await draw(scheme);
    const all = fills();
    for (const c of has) expect(all).toContain(argb(c));
    for (const c of lacks) expect(all).not.toContain(argb(c));
  });

  it('draws the same picture with reduced motion', async () => {
    reduceMotion.mockReturnValue(true);
    await draw('light');
    expect(fills()).toContain(argb('#a8e03a'));
  });
});
