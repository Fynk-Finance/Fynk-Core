// The Inicio illustration moves like the design unless the system asks to reduce motion.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

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
