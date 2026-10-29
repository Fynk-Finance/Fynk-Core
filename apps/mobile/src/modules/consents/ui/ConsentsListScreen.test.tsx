// Consentimientos (HU-007): status, dates, up-to-date information, empty and error, both themes.
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock } from '@shared/testing';
import { ThemeProvider, uiStrings, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import type { Consent } from '../domain/consent';
import type { ConsentsApiPort } from '../application/ports';
import { fakeConsentsApi } from '../testing/fakeConsentsApi';
import { createConsentsListScreen } from './ConsentsListScreen';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings.list;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const NOW = '2026-10-29T15:00:00Z';

const base: Consent = {
  id: 'c-active',
  provider: 'banco-demo',
  scopes: ['balances', 'transactions', 'account_details'],
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
  status: 'active',
  textVersion: '2026-10-v1',
  createdAt: '2026-09-03T15:00:00Z',
  acceptedAt: '2026-09-03T15:00:00Z',
  grantedAt: '2026-09-03T15:01:00Z',
  expiresAt: '2027-09-03T15:01:00Z',
};
const pending: Consent = {
  ...base,
  id: 'c-pending',
  provider: 'billetera-demo',
  status: 'pending',
  createdAt: '2026-10-20T15:00:00Z',
  grantedAt: undefined,
  expiresAt: undefined,
};
const revoked: Consent = {
  ...base,
  id: 'c-revoked',
  status: 'revoked',
  createdAt: '2026-08-01T15:00:00Z',
  revokedAt: '2026-10-12T15:00:00Z',
};
// The server still says active, but its end has passed.
const pastEnd: Consent = {
  ...base,
  id: 'c-past',
  provider: 'bancolombia',
  createdAt: '2025-10-01T15:00:00Z',
  grantedAt: '2025-10-01T15:00:00Z',
  expiresAt: '2026-10-01T15:00:00Z',
};

const names = { 'banco-demo': 'Banco Demo', 'billetera-demo': 'Billetera Demo' };

function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

function Opened() {
  const route = useRoute();
  return <Text>{`Abierto ${route.name} ${JSON.stringify(route.params ?? {})}`}</Text>;
}

const Stack = createNativeStackNavigator();

async function renderList(list: ConsentsApiPort['list'], scheme: ColorScheme = 'light') {
  const api = fakeConsentsApi({ list, entityNames: async () => names });
  const List = createConsentsListScreen({ api, clock: createFixedClock(NOW) });
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  await render(
    <ThemeProvider initialPreference={scheme} store={noStore}>
      <QueryClientProvider client={client}>
        <ProbeColors />
        <NavigationContainer
          initialState={{ index: 1, routes: [{ name: 'start' }, { name: 'consents.List' }] }}
        >
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="start" component={Opened} />
            <Stack.Screen name="consents.List" component={List} />
            <Stack.Screen name="consents.Detail" component={Opened} />
            <Stack.Screen name="bank.Connect" component={Opened} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.queryByLabelText(uiStrings.loading)).toBeNull());
  return { api };
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
});

it('shows each consent with its entity, status chip and dates in Bogotá time (HU-007)', async () => {
  await renderList(async () => [base]);
  expect(screen.getByText(t.title)).toBeOnTheScreen();
  expect(screen.getByText(t.section)).toBeOnTheScreen();
  expect(screen.getByText('Banco Demo')).toBeOnTheScreen();
  expect(screen.getByText('Activo')).toBeOnTheScreen();
  expect(screen.getByText('Otorgado el 3 sep 2026')).toBeOnTheScreen();
  expect(screen.getByText('Vence el 3 sep 2027')).toBeOnTheScreen();
});

it('shows every status: Activo, Pendiente, Vencido and Revocado, live ones first', async () => {
  await renderList(async () => [revoked, pastEnd, pending, base]);
  const ids = screen
    .getAllByTestId(/^consents\.row\.[^.]+$/)
    .map((row) => row.props.testID as string);
  expect(ids).toEqual([
    'consents.row.c-active',
    'consents.row.c-pending',
    'consents.row.c-past',
    'consents.row.c-revoked',
  ]);
  expect(screen.getByText('Pendiente')).toBeOnTheScreen();
  expect(screen.getByText('Solicitado el 20 oct 2026')).toBeOnTheScreen();
  // Past its end: expired now, without waiting for the server's daily job.
  expect(screen.getByText('Vencido')).toBeOnTheScreen();
  expect(screen.getByText('Venció el 1 oct 2026')).toBeOnTheScreen();
  expect(screen.getByText('Revocado')).toBeOnTheScreen();
  expect(screen.getByText('Revocado el 12 oct 2026')).toBeOnTheScreen();
  // An entity no longer listed by M5 keeps its id as name.
  expect(screen.getByText('bancolombia')).toBeOnTheScreen();
});

it('keeps the information up to date: a pull to refresh reads the list again', async () => {
  let items = [base];
  const { api } = await renderList(async () => items);
  expect(screen.getByText('Activo')).toBeOnTheScreen();

  items = [{ ...base, status: 'revoked', revokedAt: '2026-10-29T14:00:00Z' }];
  const { refreshControl } = screen.getByTestId('consents.listScroll').props as {
    refreshControl: { props: { onRefresh: () => void } };
  };
  await act(async () => refreshControl.props.onRefresh());
  expect(await screen.findByText('Revocado')).toBeOnTheScreen();
  expect(api.list).toHaveBeenCalledTimes(2);
});

it('opens the detail of a consent', async () => {
  await renderList(async () => [base]);
  await fireEvent.press(screen.getByTestId('consents.row.c-active'));
  expect(await screen.findByText('Abierto consents.Detail {"id":"c-active"}')).toBeOnTheScreen();
});

it('shows the empty state with a way to connect a bank', async () => {
  await renderList(async () => []);
  expect(screen.getByText(t.empty)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: t.connect }));
  expect(await screen.findByText('Abierto bank.Connect {}')).toBeOnTheScreen();
});

it('shows an error with a retry', async () => {
  let fail = true;
  await renderList(async () => {
    if (fail) throw new Error('offline');
    return [base];
  });
  expect(await screen.findByText(t.error)).toBeOnTheScreen();
  fail = false;
  await fireEvent.press(screen.getByRole('button', { name: uiStrings.retry }));
  expect(await screen.findByText('Banco Demo')).toBeOnTheScreen();
});

it('goes back with the Volver button', async () => {
  await renderList(async () => [base]);
  await fireEvent.press(screen.getByTestId('consents.back'));
  expect(await screen.findByText('Abierto start {}')).toBeOnTheScreen();
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('draws the page, the card and the dividers from the theme', async () => {
    await renderList(async () => [base, pending], scheme);
    const colors = themeColors();
    expect(colors.background).toBe(scheme === 'light' ? '#FFFFFF' : '#13212D');
    expect(screen.getByTestId('consents.listScreen')).toHaveStyle({
      backgroundColor: colors.background,
    });
    expect(screen.getByTestId('consents.list')).toHaveStyle({ borderColor: colors.borderBlue });
    expect(screen.getByTestId('consents.row.c-pending')).toHaveStyle({
      borderTopColor: colors.divider,
    });
  });
});
