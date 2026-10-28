import { fireEvent, render, screen } from '@testing-library/react-native';

import { uiStrings } from '../strings.es-CO';
import { lightColors as colors } from '../tokens';
import { AmountText } from './AmountText';
import { initialsOf } from './Avatar';
import { GhostButton, PrimaryButton } from './Button';
import { Badge } from './Badge';
import { Chip } from './Chip';
import { donutArcs } from './Donut';
import { HeaderBlue } from './HeaderBlue';
import { ProgressBar } from './ProgressBar';
import { StepProgress } from './StepProgress';
import { TextField } from './TextField';

describe('AmountText', () => {
  it('draws the typographic minus but reads the plain amount', async () => {
    await render(<AmountText amountMinor={-18430000} signed testID="a" />);
    const text = screen.getByTestId('a');
    expect(text).toHaveTextContent('−$184.300');
    expect(text.props.accessibilityLabel).toBe('-$184.300');
  });

  it('colors income blue and spending ink', async () => {
    await render(
      <>
        <AmountText amountMinor={520000000} signed testID="in" />
        <AmountText amountMinor={-100} signed testID="out" />
      </>,
    );
    expect(screen.getByTestId('in')).toHaveStyle({ color: colors.primaryDark });
    expect(screen.getByTestId('out')).toHaveStyle({ color: colors.textPrimary });
  });

  it('prints unsigned balances with dot thousands', async () => {
    await render(<AmountText amountMinor={1248035000} size={34} testID="b" />);
    expect(screen.getByTestId('b')).toHaveTextContent('$12.480.350');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Laura Gómez', 'LG'],
    ['laura', 'L'],
    ['  María José   Pérez Díaz ', 'MD'],
    ['', ''],
  ])('%p gives %p', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe('buttons', () => {
  it('calls onPress and exposes the label to screen readers', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Continuar" withArrow onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not press while disabled or loading', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <PrimaryButton label="Uno" disabled onPress={onPress} />
        <GhostButton label="Dos" loading onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Uno' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dos' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dos' })).toBeBusy();
  });
});

describe('TextField', () => {
  it('hides a password until the eye is pressed', async () => {
    await render(<TextField label="Contraseña" secure testID="pwd" />);
    expect(screen.getByTestId('pwd').props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: uiStrings.showPassword }));

    expect(screen.getByTestId('pwd').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: uiStrings.hidePassword })).toBeTruthy();
  });

  it('shows the error instead of the helper', async () => {
    await render(<TextField label="Correo" helper="Ayuda" error="Escribe un correo válido." />);
    expect(screen.getByText('Escribe un correo válido.')).toBeTruthy();
    expect(screen.queryByText('Ayuda')).toBeNull();
  });
});

describe('Chip', () => {
  it('reports its selected state', async () => {
    await render(<Chip label="Todas" selected />);
    expect(screen.getByRole('button', { name: 'Todas' })).toBeSelected();
  });
});

describe('HeaderBlue', () => {
  it('shows the lime dot only when there is something unread', async () => {
    const { rerender } = await render(<HeaderBlue name="Laura Gómez" hasUnread />);
    expect(screen.getByTestId('header-unread-dot')).toBeTruthy();
    expect(screen.getByText('LG', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(uiStrings.greeting)).toBeTruthy();

    await rerender(<HeaderBlue name="Laura Gómez" />);
    expect(screen.queryByTestId('header-unread-dot')).toBeNull();
  });

  it('opens notifications from the bell', async () => {
    const onPress = jest.fn();
    await render(<HeaderBlue name="Laura" hasUnread onPressNotifications={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: uiStrings.notificationsUnread }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it.each([
    [0.64, 64],
    [-1, 0],
    [3, 100],
    [Number.NaN, 0],
  ])('clamps %p to %p %%', async (progress, percent) => {
    await render(<ProgressBar progress={progress} />);
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ now: percent });
  });
});

describe('StepProgress', () => {
  it('says which step of five and lets the user skip', async () => {
    const onSkip = jest.fn();
    await render(<StepProgress step={2} onBack={() => {}} onSkip={onSkip} />);
    expect(screen.getByText('Paso 2 de 5')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 1, max: 5, now: 2 });
    await fireEvent.press(screen.getByRole('button', { name: uiStrings.skip }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('donutArcs', () => {
  const c = 2 * Math.PI * 54; // 339.3, the Recomendaciones donut

  it('splits the circle by value, leaving a gap between arcs', () => {
    const arcs = donutArcs(
      [
        { value: 56800, color: 'primaryLight' },
        { value: 45000, color: 'accent' },
        { value: 25000, color: 'primaryDark' },
      ],
      c,
      14,
    );
    const lengths = arcs.map((a) => a.length);
    const total = lengths.reduce((s, l) => s + l, 0);
    expect(total + 3 * 14).toBeCloseTo(c, 5);
    expect(lengths[0]! / lengths[1]!).toBeCloseTo(56800 / 45000, 5);
    expect(arcs[0]!.offset).toBe(-7);
    expect(arcs[1]!.offset).toBeCloseTo(-(7 + lengths[0]! + 14), 5);
  });

  it('skips zero and negative values and returns nothing for an empty total', () => {
    expect(donutArcs([{ value: 0, color: 'accent' }], c, 14)).toEqual([]);
    expect(
      donutArcs(
        [
          { value: 10, color: 'accent' },
          { value: -5, color: 'danger' },
        ],
        c,
        14,
      ),
    ).toHaveLength(1);
  });
});

type Json = ReturnType<typeof screen.toJSON>;
type JsonNode = Exclude<Json, null | unknown[]>;

function findByType(node: Json, type: string): JsonNode | undefined {
  if (node === null) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child as Json, type);
      if (found) return found;
    }
    return undefined;
  }
  if (node.type === type) return node;
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const found = findByType(child, type);
    if (found) return found;
  }
  return undefined;
}

describe('Badge', () => {
  it('uses 11 px text for the lg size and 10 px by default', async () => {
    await render(
      <>
        <Badge label="Grande" size="lg" testID="lg" />
        <Badge label="Normal" testID="md" />
      </>,
    );
    expect(screen.getByText('Grande')).toHaveStyle({ fontSize: 11, lineHeight: 14 });
    expect(screen.getByText('Normal')).toHaveStyle({ fontSize: 10 });
  });

  it('draws the icon with the foreground color of the tone', async () => {
    await render(<Badge label="Perfil verificado" tone="accent" size="lg" icon="check" />);
    const svg = findByType(screen.toJSON(), 'RNSVGSvgView');
    expect(svg?.props).toMatchObject({
      width: 12,
      height: 12,
      stroke: colors.onPrimary,
      strokeWidth: 3.2,
    });
  });

  it('draws no icon unless asked', async () => {
    await render(<Badge label="Simulado" />);
    expect(findByType(screen.toJSON(), 'RNSVGSvgView')).toBeUndefined();
  });
});
