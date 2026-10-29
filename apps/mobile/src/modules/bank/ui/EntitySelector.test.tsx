// Entity selector of Conectar banco: chosen entity, "Simulado", the list, both themes.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import type { BankProvider } from '../domain/provider';
import { EntitySelector } from './EntitySelector';
import { bankStrings } from './strings.es-CO';

const t = bankStrings.selector;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

const bancoDemo: BankProvider = {
  id: 'banco-demo',
  displayName: 'Banco Demo',
  kind: 'bank',
  isSimulated: true,
  supportedScopes: ['balances', 'transactions', 'account_details'],
  logoKey: 'banco-demo',
};
const billeteraDemo: BankProvider = {
  ...bancoDemo,
  id: 'billetera-demo',
  displayName: 'Billetera Demo',
  kind: 'wallet',
  logoKey: 'billetera-demo',
};
const realBank: BankProvider = {
  ...bancoDemo,
  id: 'real',
  displayName: 'Banco Real',
  isSimulated: false,
};

function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

async function renderSelector(providers: BankProvider[], scheme: ColorScheme = 'light') {
  const onSelect = jest.fn();
  function Host() {
    const [selected, setSelected] = useState(providers[0]!);
    return (
      <EntitySelector
        providers={providers}
        selected={selected}
        onSelect={(p) => {
          onSelect(p);
          setSelected(p);
        }}
      />
    );
  }
  await render(
    <ThemeProvider initialPreference={scheme} store={noStore}>
      <ProbeColors />
      <Host />
    </ThemeProvider>,
  );
  return { onSelect };
}

it('shows the label and the chosen entity with its kind and the Simulado badge (HU-009)', async () => {
  await renderSelector([bancoDemo, billeteraDemo]);
  expect(screen.getByText(t.label)).toBeOnTheScreen();
  expect(screen.getByText('Banco Demo')).toBeOnTheScreen();
  expect(screen.getByText('Banco')).toBeOnTheScreen();
  expect(screen.getByText('Simulado')).toBeOnTheScreen();
  expect(screen.queryByTestId('bank.selector.list')).toBeNull();
  expect(screen.getByTestId('bank.selector')).not.toBeExpanded();
});

it('opens the list, and choosing an entity closes it and tells the host', async () => {
  const { onSelect } = await renderSelector([bancoDemo, billeteraDemo]);
  await fireEvent.press(screen.getByTestId('bank.selector'));
  expect(screen.getByTestId('bank.selector')).toBeExpanded();
  expect(screen.getByTestId('bank.selector.option.banco-demo')).toBeSelected();
  expect(screen.getByTestId('bank.selector.option.billetera-demo')).not.toBeSelected();

  await fireEvent.press(screen.getByTestId('bank.selector.option.billetera-demo'));
  expect(onSelect).toHaveBeenCalledWith(billeteraDemo);
  expect(screen.queryByTestId('bank.selector.list')).toBeNull();
  expect(screen.getByText('Billetera Demo')).toBeOnTheScreen();
  expect(screen.getByText('Billetera digital')).toBeOnTheScreen();
});

it('closes without telling the host when the chosen entity is pressed again', async () => {
  const { onSelect } = await renderSelector([bancoDemo, billeteraDemo]);
  await fireEvent.press(screen.getByTestId('bank.selector'));
  await fireEvent.press(screen.getByTestId('bank.selector.option.banco-demo'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByTestId('bank.selector.list')).toBeNull();
});

it('shows no Simulado badge on a real entity', async () => {
  await renderSelector([realBank]);
  expect(screen.getByText('Banco Real')).toBeOnTheScreen();
  expect(screen.queryByText('Simulado')).toBeNull();
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('draws the field with the theme colors', async () => {
    await renderSelector([bancoDemo], scheme);
    const colors = themeColors();
    expect(colors.background).toBe(scheme === 'light' ? '#FFFFFF' : '#13212D');
    expect(screen.getByTestId('bank.selector')).toHaveStyle({
      backgroundColor: colors.surfaceBlueSoft,
      borderColor: colors.borderBlue,
    });
  });
});
