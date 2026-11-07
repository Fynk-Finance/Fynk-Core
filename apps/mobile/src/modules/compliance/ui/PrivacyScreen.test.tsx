import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@shared/ui';

import { createPrivacyScreen } from './PrivacyScreen';
import { complianceStrings } from './strings.es-CO';

const t = complianceStrings.privacy;
const noStore = { load: async () => 'light' as const, save: async () => undefined };

const Stack = createNativeStackNavigator();

const MockConnectedAccounts = () => null;
const PrivacyScreen = createPrivacyScreen({ ConnectedAccounts: MockConnectedAccounts });

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return await render(
    <ThemeProvider initialPreference="light" store={noStore}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="compliance.Privacy" component={PrivacyScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('PrivacyScreen (CfgPrivacidad)', () => {
  it('renders title, subtitle and usage section', async () => {
    await renderScreen();

    expect(screen.getByText(t.title)).toBeOnTheScreen();
    expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
    expect(screen.getByText(t.usage.title)).toBeOnTheScreen();
    expect(screen.getByText(t.usage.footer)).toBeOnTheScreen();
  });

  it('renders usage preferences with switches and allows toggling', async () => {
    await renderScreen();

    expect(screen.getByText(t.usage.ai.title)).toBeOnTheScreen();
    expect(screen.getByText(t.usage.improve.title)).toBeOnTheScreen();
    expect(screen.getByText(t.usage.offers.title)).toBeOnTheScreen();

    const aiSwitch = screen.getByTestId('privacy.switch.ai');
    expect(aiSwitch).toBeOnTheScreen();

    const improveSwitch = screen.getByTestId('privacy.switch.improve');
    expect(improveSwitch).toBeOnTheScreen();

    const offersSwitch = screen.getByTestId('privacy.switch.offers');
    expect(offersSwitch).toBeOnTheScreen();

    await fireEvent.press(aiSwitch);
    await fireEvent.press(improveSwitch);
    await fireEvent.press(offersSwitch);
  });

  it('renders legal and data information rows', async () => {
    await renderScreen();

    expect(screen.getByText(t.info.title)).toBeOnTheScreen();
    expect(screen.getByText(t.info.download.title)).toBeOnTheScreen();
    expect(screen.getByText(t.info.policy.title)).toBeOnTheScreen();
    expect(screen.getByText(t.info.terms.title)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('privacy.info.download'));
    await fireEvent.press(screen.getByTestId('privacy.info.policy'));
    await fireEvent.press(screen.getByTestId('privacy.info.terms'));
  });
});
