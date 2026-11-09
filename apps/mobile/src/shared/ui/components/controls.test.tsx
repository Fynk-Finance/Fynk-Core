// Behavior of the controls added with the 27 Oct 2026 design: each one works by tap (the button
// behind every gesture) and tells screen readers its state.
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { darkColors, lightColors } from '../tokens';
import { Fab } from './Fab';
import { PageDots } from './PageDots';
import { SearchField } from './SearchField';
import { SegmentedControl } from './SegmentedControl';
import { Switch } from './Switch';

const noStore = { load: async () => 'dark' as const, save: async () => {} };

describe('Switch', () => {
  it('turns on and off by tap and reads as a switch', async () => {
    const onChange = jest.fn();
    await render(<Switch value={false} onValueChange={onChange} accessibilityLabel="Saldo bajo" />);
    const toggle = screen.getByRole('switch', { name: 'Saldo bajo' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows the on state', async () => {
    await render(<Switch value onValueChange={() => {}} accessibilityLabel="Avance de metas" />);
    expect(screen.getByRole('switch', { name: 'Avance de metas' })).toBeChecked();
  });

  it('does nothing when disabled', async () => {
    const onChange = jest.fn();
    await render(<Switch value onValueChange={onChange} accessibilityLabel="Ingresos" disabled />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Ingresos' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

/** WCAG contrast ratio of two #RRGGBB colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('SegmentedControl', () => {
  const options = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
  ];

  it('marks the selected option and reports a new choice', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={options}
        value="week"
        onChange={onChange}
        accessibilityLabel="Periodo de la gráfica"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Semana' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mes' }));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('ignores a tap on the option already selected', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={options}
        value="week"
        onChange={onChange}
        accessibilityLabel="Periodo"
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Semana' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  const props = {
    options,
    value: 'week',
    onChange: () => {},
    accessibilityLabel: 'Periodo',
  };

  // QA review 2026-11-07, V12: on the page the white text of the header version was invisible.
  it('reads on the page background in light mode: dark text, the choice blue on the page color', async () => {
    await render(<SegmentedControl {...props} />);
    expect(screen.getByText('Mes')).toHaveStyle({ color: lightColors.textPrimary });
    expect(screen.getByText('Semana')).toHaveStyle({ color: lightColors.primaryText });
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveStyle({
      backgroundColor: lightColors.background,
      borderColor: lightColors.borderBlueStrong,
    });
  });

  // SCRUM-87: AA contrast (4.5:1 for 13 px text) in both themes.
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ])('meets AA contrast on the page in the %s theme', (_, c) => {
    expect(contrast(c.primaryText, c.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textPrimary, c.surfaceBlueSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the dark palette on the page in dark mode', async () => {
    await render(
      <ThemeProvider initialPreference="dark" store={noStore}>
        <SegmentedControl {...props} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Mes')).toHaveStyle({ color: darkColors.textPrimary });
    expect(screen.getByText('Semana')).toHaveStyle({ color: darkColors.primaryText });
    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveStyle({
      backgroundColor: darkColors.background,
    });
  });

  it('on a blue header draws white text and the selected text in the design blue of each theme', async () => {
    await render(<SegmentedControl {...props} onPrimary />);
    expect(screen.getByText('Semana')).toHaveStyle({ color: lightColors.primaryText });
    expect(screen.getByText('Mes')).toHaveStyle({ color: lightColors.onPrimary });
    await render(
      <ThemeProvider initialPreference="dark" store={noStore}>
        <SegmentedControl {...props} onPrimary />
      </ThemeProvider>,
    );
    expect(screen.getByText('Semana')).toHaveStyle({ color: darkColors.primaryText });
  });
});

describe('PageDots', () => {
  it('changes page by tapping a dot, the button behind the swipe', async () => {
    const onSelect = jest.fn();
    await render(
      <PageDots labels={['Ver Banco Demo', 'Ver Efectivo']} index={0} onSelect={onSelect} />,
    );
    expect(screen.getByRole('button', { name: 'Ver Banco Demo' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver Efectivo' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('Fab', () => {
  it('runs its action and tells whether its menu is open', async () => {
    const onPress = jest.fn();
    await render(<Fab onPress={onPress} accessibilityLabel="Registrar gasto o ingreso" expanded />);
    const fab = screen.getByRole('button', { name: 'Registrar gasto o ingreso' });
    expect(fab).toBeExpanded();
    await fireEvent.press(fab);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the label of the extended button', async () => {
    await render(
      <Fab onPress={() => {}} accessibilityLabel="Crear nueva meta de ahorro" label="Nueva meta" />,
    );
    expect(screen.getByText('Nueva meta')).toBeTruthy();
  });
});

describe('SearchField', () => {
  it('is labeled by its placeholder and reports what is typed', async () => {
    const onChangeText = jest.fn();
    await render(<SearchField placeholder="Buscar por nombre" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Buscar por nombre');
    await fireEvent.changeText(input, 'Café');
    expect(onChangeText).toHaveBeenCalledWith('Café');
  });
});
