// The design animations run unless the system asks to reduce motion.
import { render, screen } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Shine } from './Shine';
import { Skeleton } from './States';

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

describe('motion', () => {
  it('draws the shine when motion is allowed', async () => {
    reduceMotion.mockReturnValue(false);
    await render(<Shine distance={500} height={200} />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('removes the shine when reduced motion is on', async () => {
    reduceMotion.mockReturnValue(true);
    await render(<Shine distance={500} height={200} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('keeps the skeleton visible either way', async () => {
    for (const reduced of [false, true]) {
      reduceMotion.mockReturnValue(reduced);
      await render(<Skeleton height={20} />);
      expect(screen.toJSON()).not.toBeNull();
    }
  });
});
