// Conectar banco end to end on the phone side: providers, M4's consent part, the recorded consent,
// loading, errors, back, both themes. The API is faked at fetch, so the real M4 exports run.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, uiStrings, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import type { BankProvider } from '../domain/provider';
import { createProvidersApi } from '../adapters/providersApi';
import { createConnectBankScreen } from './ConnectBankScreen';
import { bankStrings } from './strings.es-CO';

// expo-crypto's native randomUUID is not available under Jest.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual<object>('expo-crypto'),
  randomUUID: () => 'idempotency-key-1',
}));

const t = bankStrings.connect;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const SHA = '9f2c4e0b7a1d3c5e8f6a2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f';

const providers: BankProvider[] = [
  {
    id: 'banco-demo',
    displayName: 'Banco Demo',
    kind: 'bank',
    isSimulated: true,
    supportedScopes: ['balances', 'transactions', 'account_details'],
    logoKey: 'banco-demo',
  },
  {
    id: 'billetera-demo',
    displayName: 'Billetera Demo',
    kind: 'wallet',
    isSimulated: true,
    supportedScopes: ['balances', 'transactions', 'account_details'],
    logoKey: 'billetera-demo',
  },
];

const consentText = {
  version: '2026-10-v1',
  bodyMd: '# Autorización',
  sha256: SHA,
  publishedAt: '2026-10-27T00:00:00Z',
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
const problem = (status: number, code: string) =>
  json(status, { type: `/problems/${code}`, title: code, status, code });

interface Api {
  providers?: () => Response;
  text?: () => Response;
}

/** Fakes the Fynk API at fetch and records what was posted to /consents. */
function fakeApi(api: Api = {}) {
  const posted: { body: unknown; key: string | null }[] = [];
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path.endsWith('/providers')) return api.providers?.() ?? json(200, { items: providers });
    if (path.endsWith('/consent-texts/current')) return api.text?.() ?? json(200, consentText);
    if (path.endsWith('/consents') && request.method === 'POST') {
      const body = (await request.json()) as Record<string, unknown>;
      posted.push({ body, key: request.headers.get('Idempotency-Key') });
      return json(201, {
        id: '01928c7e-5b1a-7c3d-9e2f-4a6b8c0d2e4f',
        ...body,
        status: 'pending',
        createdAt: '2026-10-28T15:04:05Z',
        acceptedAt: '2026-10-28T15:04:05Z',
      });
    }
    return problem(404, 'not_found');
  });
  return { fetch, posted };
}

function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

function Start() {
  return <Text>Billetera</Text>;
}

const Stack = createNativeStackNavigator();

async function renderScreen(scheme: ColorScheme = 'light') {
  const onConsentReady = jest.fn();
  const ConnectBank = createConnectBankScreen({ providers: createProvidersApi(), onConsentReady });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <ThemeProvider initialPreference={scheme} store={noStore}>
      <QueryClientProvider client={client}>
        <ProbeColors />
        <NavigationContainer
          initialState={{ index: 1, routes: [{ name: 'start' }, { name: 'bank.Connect' }] }}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="start" component={Start} />
            <Stack.Screen name="bank.Connect" component={ConnectBank} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.queryByLabelText(uiStrings.loading)).toBeNull());
  return { onConsentReady };
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  jest.restoreAllMocks();
});

const button = () => screen.getByTestId('consents.goToPortal');

it('shows the header, the first entity with Simulado, the consent cards and a disabled button', async () => {
  fakeApi();
  await renderScreen();
  expect(screen.getByText(t.title)).toBeOnTheScreen();
  expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
  expect(screen.getByText('Banco o billetera digital')).toBeOnTheScreen();
  expect(screen.getByText('Simulado')).toBeOnTheScreen();
  expect(screen.getByText('Banco Demo compartirá con Fynk')).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Finalidad: mostrarte tus finanzas y recomendaciones dentro de Fynk. Vigencia: 12 meses.',
    ),
  ).toBeOnTheScreen();
  expect(screen.getByText('Ir al portal de Banco Demo')).toBeOnTheScreen();
  expect(button()).toBeDisabled();
});

it('moves the consent part to the entity the person chooses (HU-009: elige la entidad)', async () => {
  fakeApi();
  await renderScreen();
  await fireEvent.press(screen.getByTestId('bank.selector'));
  await fireEvent.press(screen.getByTestId('bank.selector.option.billetera-demo'));
  expect(screen.getByText('Billetera Demo compartirá con Fynk')).toBeOnTheScreen();
  expect(screen.getByText('Ir al portal de Billetera Demo')).toBeOnTheScreen();
  expect(screen.getByTestId('consents.checkbox')).not.toBeChecked();
});

it('records the consent for the chosen entity with what was shown, then stops', async () => {
  const { posted } = fakeApi();
  const { onConsentReady } = await renderScreen();
  await fireEvent.press(screen.getByTestId('bank.selector'));
  await fireEvent.press(screen.getByTestId('bank.selector.option.billetera-demo'));
  await fireEvent.press(screen.getByTestId('consents.checkbox'));
  await fireEvent.press(button());

  await waitFor(() => expect(onConsentReady).toHaveBeenCalledTimes(1));
  expect(posted).toHaveLength(1);
  expect(posted[0]!.key).toBe('idempotency-key-1');
  expect(posted[0]!.body).toEqual({
    provider: 'billetera-demo',
    scopes: ['balances', 'transactions', 'account_details'],
    purpose: consentText.purpose,
    termDays: 365,
    textVersion: '2026-10-v1',
    textSha256: SHA,
    appVersion: '0.1.0',
    locale: 'es-CO',
  });
  const [consent, provider] = onConsentReady.mock.calls[0]!;
  expect(consent).toMatchObject({ provider: 'billetera-demo', status: 'pending' });
  expect(provider).toMatchObject({ id: 'billetera-demo' });
});

it('shows an error with a retry when the entities cannot be loaded', async () => {
  let fail = true;
  const { fetch } = fakeApi({
    providers: () => (fail ? problem(503, 'bank_unavailable') : json(200, { items: providers })),
  });
  await renderScreen();
  expect(await screen.findByText(t.error)).toBeOnTheScreen();
  expect(screen.queryByTestId('bank.connect.bottom')).toBeNull();

  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.retry }));
  expect(await screen.findByText('Banco Demo compartirá con Fynk')).toBeOnTheScreen();
  expect(fetch).toHaveBeenCalled();
});

it('shows an error when the consent text cannot be loaded, and no button', async () => {
  fakeApi({ text: () => problem(500, 'internal') });
  await renderScreen();
  expect(await screen.findByText(t.error)).toBeOnTheScreen();
  expect(screen.queryByTestId('consents.goToPortal')).toBeNull();
});

it('shows the empty state when no entity can be connected', async () => {
  fakeApi({ providers: () => json(200, { items: [] }) });
  await renderScreen();
  expect(screen.getByText(t.empty)).toBeOnTheScreen();
  expect(screen.queryByTestId('consents.goToPortal')).toBeNull();
});

it('goes back with the Volver button', async () => {
  fakeApi();
  await renderScreen();
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.back }));
  expect(await screen.findByText('Billetera')).toBeOnTheScreen();
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('keeps the blue header and draws the page and bottom bar from the theme', async () => {
    fakeApi();
    await renderScreen(scheme);
    const colors = themeColors();
    expect(colors.background).toBe(scheme === 'light' ? '#FFFFFF' : '#13212D');
    expect(screen.getByTestId('bank.connect.header')).toHaveStyle({ backgroundColor: '#2FA8D8' });
    expect(screen.getByTestId('bank.connect')).toHaveStyle({ backgroundColor: colors.background });
    expect(screen.getByTestId('bank.connect.bottom')).toHaveStyle({
      backgroundColor: colors.background,
      borderTopColor: colors.divider,
    });
  });
});
