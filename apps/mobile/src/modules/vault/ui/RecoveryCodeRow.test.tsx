// "Código de recuperación" row of Seguridad: the section, the hint and the navigation.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { RECOVERY_CODE_ROUTE, RecoveryCodeRow } from './RecoveryCodeRow';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.recovery.row;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();

const Target = () => <Text testID="target">new code</Text>;

async function renderRow(preference: ThemePreference = 'light') {
  await render(
    <ThemeProvider initialPreference={preference} store={noStore}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="identity.Security" component={RecoveryCodeRow} />
          <Stack.Screen name={RECOVERY_CODE_ROUTE} component={Target} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
}

it('is the route that index.ts registers', () => {
  expect(RECOVERY_CODE_ROUTE).toBe('vault.RecoveryCode');
});

it('shows the section with "Generar un código nuevo" and its hint', async () => {
  await renderRow();
  expect(screen.getByRole('header', { name: t.section })).toBeOnTheScreen();
  expect(screen.getByText(t.title)).toBeOnTheScreen();
  expect(screen.getByText(t.hint)).toBeOnTheScreen();
});

it('opens the new code screen when pressed', async () => {
  await renderRow();
  await fireEvent.press(screen.getByRole('button', { name: `${t.title}. ${t.hint}` }));
  await waitFor(() => expect(screen.getByTestId('target')).toBeOnTheScreen());
});

it.each(['light', 'dark'] as const)('draws in the %s theme', async (preference) => {
  await renderRow(preference);
  expect(screen.getByTestId('vault.recoveryRow')).toBeOnTheScreen();
  expect(screen.getByTestId('vault.recoveryRow.new')).toBeOnTheScreen();
});
