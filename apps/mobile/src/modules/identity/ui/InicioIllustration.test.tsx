// The Inicio illustration moves like the design unless the system asks to reduce motion.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemeProvider } from '@shared/ui';

import { InicioIllustration } from './InicioIllustration';
import { DROP, FLOAT, SHINE, TWINKLE_SCALE, easeInOut, sampleKeyframes } from './inicioMotion';

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
const LAYER = 'identity.inicio.illustration.layer.';
const LAYERS = [
  'shadow',
  'card--20',
  'card--8',
  'drop-left',
  'drop-right',
  'spark-0',
  'spark--1200',
  'spark--2200',
];

async function renderMeasured() {
  await render(<InicioIllustration />);
  await fireEvent(screen.getByTestId('identity.inicio.illustration'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 310, height: 331 } },
  });
}

describe('InicioIllustration', () => {
  it('draws one animated layer per moving group once it knows its size', async () => {
    reduceMotion.mockReturnValue(false);
    await renderMeasured();
    for (const name of LAYERS) expect(screen.getByTestId(LAYER + name)).toBeOnTheScreen();
  });

  it('shows the resting frame until it is measured', async () => {
    reduceMotion.mockReturnValue(false);
    await render(<InicioIllustration />);
    expect(screen.getByTestId('identity.inicio.illustration')).toBeOnTheScreen();
    expect(screen.queryByTestId(LAYER + 'shadow')).toBeNull();
  });

  it('starts no animation and draws no layer with reduced motion', async () => {
    reduceMotion.mockReturnValue(true);
    await renderMeasured();
    expect(screen.getByTestId('identity.inicio.illustration')).toBeOnTheScreen();
    for (const name of LAYERS) expect(screen.queryByTestId(LAYER + name)).toBeNull();
  });

  it('keeps the accessible image', async () => {
    reduceMotion.mockReturnValue(false);
    await renderMeasured();
    expect(screen.getByRole('image')).toBeOnTheScreen();
  });
});

describe('InicioIllustration colors', () => {
  const noStore = { load: async () => 'light' as const, save: async () => {} };
  // react-native-svg hands fills to the native side as opaque ARGB numbers.
  const fills = () => JSON.stringify(screen.toJSON());
  const argb = (hex: string) => `"payload":${0xff000000 + parseInt(hex.slice(1), 16)}`;

  it.each([
    ['light', ['#f4fbfe', '#e4f5fc', '#d2eef9', '#eef9fe'], ['#182a37', '#1a3444', '#1d3a4a']],
    ['dark', ['#182a37', '#1a3444', '#1d3a4a'], ['#f4fbfe', '#e4f5fc', '#d2eef9', '#eef9fe']],
  ] as const)('draws the %s backdrop, shadow and card square', async (scheme, has, lacks) => {
    reduceMotion.mockReturnValue(true);
    await render(
      <ThemeProvider initialPreference={scheme} store={noStore}>
        <InicioIllustration />
      </ThemeProvider>,
    );
    const all = fills();
    for (const c of has) expect(all).toContain(argb(c));
    for (const c of lacks) expect(all).not.toContain(argb(c));
  });
});

describe('keyframes', () => {
  it('follows fk-float and fk-drop', () => {
    expect(sampleKeyframes(FLOAT, 0)).toBe(0);
    expect(sampleKeyframes(FLOAT, 0.5)).toBeCloseTo(-10);
    expect(sampleKeyframes(FLOAT, 1)).toBeCloseTo(0);
    expect(sampleKeyframes(DROP, 0.5)).toBe(0);
    expect(sampleKeyframes(DROP, 0.78)).toBeCloseTo(-16);
    expect(sampleKeyframes(DROP, 0.93)).toBeCloseTo(-3);
    expect(sampleKeyframes(DROP, 0.99)).toBeCloseTo(0);
  });

  it('waits, sweeps and rests like fk-shine', () => {
    expect(sampleKeyframes(SHINE, 0.58)).toBe(0);
    expect(sampleKeyframes(SHINE, 0.7)).toBeCloseTo(170);
    expect(sampleKeyframes(SHINE, 0.82)).toBeCloseTo(340);
    expect(sampleKeyframes(SHINE, 0.95)).toBe(340);
  });

  it('twinkles between .6 and 1 and eases in and out', () => {
    expect(sampleKeyframes(TWINKLE_SCALE, 0)).toBeCloseTo(0.6);
    expect(sampleKeyframes(TWINKLE_SCALE, 0.5)).toBeCloseTo(1);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });
});
