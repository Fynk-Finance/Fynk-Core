// Mi cuenta › Apariencia: Sistema is the default, Claro and Oscuro apply at once and are saved.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import { AppearanceScreen } from './AppearanceScreen';

function memoryStore(saved: ThemePreference) {
  let value = saved;
  return {
    load: jest.fn(async () => value),
    save: jest.fn(async (next: ThemePreference) => {
      value = next;
    }),
  };
}

function SchemeProbe() {
  return <Text testID="scheme">{useTheme().scheme}</Text>;
}

const Stack = createNativeStackNavigator();

async function renderScreen(store: ReturnType<typeof memoryStore>) {
  await render(
    <ThemeProvider store={store}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Appearance" component={AppearanceScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <SchemeProbe />
    </ThemeProvider>,
  );
  await act(async () => {});
}

describe('AppearanceScreen', () => {
  it('starts on Sistema, the default', async () => {
    await renderScreen(memoryStore('system'));
    expect(screen.getByRole('header', { name: 'Apariencia' })).toBeTruthy();
    expect(screen.getByTestId('appearance-system')).toBeSelected();
  });

  it('switches to Oscuro at once and saves the choice', async () => {
    const store = memoryStore('system');
    await renderScreen(store);

    await fireEvent.press(screen.getByRole('button', { name: 'Oscuro' }));

    expect(screen.getByTestId('appearance-dark')).toBeSelected();
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    expect(store.save).toHaveBeenLastCalledWith('dark');
  });

  it('shows the saved choice when it opens', async () => {
    await renderScreen(memoryStore('light'));
    expect(screen.getByTestId('appearance-light')).toBeSelected();
  });
});
