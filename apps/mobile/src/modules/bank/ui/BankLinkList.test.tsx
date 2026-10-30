// The exported pieces for M3 and M6: the connected account rows and "Agregar otra cuenta".
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import { BankLinkList } from './BankLinkList';
import { CONNECT_BANK_ROUTE, ConnectBankButton } from './ConnectBankButton';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

const wrap = (node: React.ReactNode, scheme: ColorScheme = 'light') => (
  <ThemeProvider initialPreference={scheme} store={noStore}>
    <ProbeColors />
    {node}
  </ThemeProvider>
);

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('draws each account with its type, Conectada and its balance', async () => {
    await render(
      wrap(
        <BankLinkList
          items={[
            { id: 'a', displayName: 'Banco Demo', kind: 'savings', balanceMinor: 320_000_000 },
            { id: 'b', displayName: 'Billetera Demo', kind: 'wallet', balanceMinor: 460_000_000 },
          ]}
        />,
        scheme,
      ),
    );
    expect(screen.getByLabelText('Banco Demo, Cuenta de ahorros, Conectada')).toBeOnTheScreen();
    expect(screen.getByText('Billetera digital · ')).toBeOnTheScreen();
    expect(screen.getByText('$4.600.000')).toBeOnTheScreen();
    const colors = themeColors();
    expect(screen.getByTestId('bank.linkList.a')).toHaveStyle({
      backgroundColor: colors.background,
      borderColor: colors.borderBlue,
    });
  });
});

it('opens Conectar banco from Agregar otra cuenta', async () => {
  const Target = () => <Text>arrived</Text>;
  const Start = () => <ConnectBankButton />;
  await render(
    wrap(
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="start" component={Start} />
          <Stack.Screen name={CONNECT_BANK_ROUTE} component={Target} />
        </Stack.Navigator>
      </NavigationContainer>,
    ),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar otra cuenta' }));
  expect(await screen.findByText('arrived')).toBeOnTheScreen();
});
