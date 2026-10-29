// Consent detail and revoking from the app (HU-007, HU-008), plus "Cuentas conectadas" for M13.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';

import { ApiError } from '@shared/api';
import { createFixedClock } from '@shared/testing';
import { ThemeProvider, uiStrings, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import type { Consent } from '../domain/consent';
import type { ConsentsApiPort } from '../application/ports';
import { createRevocation, type IdentityCheck } from '../application/revocation';
import { fakeConsentsApi } from '../testing/fakeConsentsApi';
import { createConnectedAccountsSection } from './ConnectedAccountsSection';
import { createConsentDetailScreen } from './ConsentDetailScreen';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const NOW = '2026-10-29T15:00:00Z';

const active: Consent = {
  id: 'c-1',
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
const revokedNow: Consent = { ...active, status: 'revoked', revokedAt: NOW };

function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

/** Answers the confirmation dialog with the button of the given style. */
function answerConfirm(style: 'destructive' | 'cancel') {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === style)?.onPress?.();
  });
}

interface Options {
  consent?: Consent;
  revoke?: ConsentsApiPort['revoke'];
  identityCheck?: IdentityCheck;
  scheme?: ColorScheme;
}

const Stack = createNativeStackNavigator();

function setup(options: Options) {
  let current = options.consent ?? active;
  const api = fakeConsentsApi({
    get: async () => current,
    list: async () => [current],
    entityNames: async () => ({ 'banco-demo': 'Banco Demo' }),
    revoke:
      options.revoke ??
      (async () => {
        current = revokedNow;
        return revokedNow;
      }),
  });
  const revocation = createRevocation(api);
  if (options.identityCheck) revocation.installIdentityCheck(options.identityCheck);
  const onRevoked = jest.fn();
  revocation.onConsentRevoked(onRevoked);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const deps = { api, clock: createFixedClock(NOW), revocation };
  return { api, onRevoked, client, deps };
}

async function renderDetail(options: Options = {}) {
  const ctx = setup(options);
  const Detail = createConsentDetailScreen(ctx.deps);
  await render(
    <ThemeProvider initialPreference={options.scheme ?? 'light'} store={noStore}>
      <QueryClientProvider client={ctx.client}>
        <ProbeColors />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="consents.Detail" component={Detail} initialParams={{ id: 'c-1' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.queryByLabelText(uiStrings.loading)).toBeNull());
  return ctx;
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  jest.restoreAllMocks();
});

describe('detail (HU-007)', () => {
  it('shows the entity, status, scope list, purpose, term, dates and text version', async () => {
    await renderDetail();
    expect(screen.getByText('Banco Demo')).toBeOnTheScreen();
    expect(screen.getByText('Activo')).toBeOnTheScreen();
    expect(screen.getByText('Banco Demo compartirá con Fynk')).toBeOnTheScreen();
    expect(screen.getByText('Saldos')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Finalidad: mostrarte tus finanzas y recomendaciones dentro de Fynk. Vigencia: 12 meses.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Otorgado el 3 sep 2026')).toBeOnTheScreen();
    expect(screen.getByText('Vence el 3 sep 2027')).toBeOnTheScreen();
    expect(screen.getByText('Versión del texto: 2026-10-v1')).toBeOnTheScreen();
    expect(screen.getByTestId('consents.detail.revoke')).toBeOnTheScreen();
  });

  it('offers no revoke for a consent that already ended', async () => {
    await renderDetail({ consent: { ...revokedNow, providerNotifiedAt: NOW } });
    expect(screen.getByText('Revocado')).toBeOnTheScreen();
    expect(screen.getByText('La entidad confirmó la revocación el 29 oct 2026')).toBeOnTheScreen();
    expect(screen.queryByTestId('consents.detail.revoke')).toBeNull();
  });

  it('says the entity is still being told while it has not confirmed', async () => {
    await renderDetail({ consent: revokedNow });
    expect(screen.getByText(t.detail.notifying)).toBeOnTheScreen();
  });
});

describe('revoke (HU-008)', () => {
  it('asks first, then revokes at once and says Fynk no longer receives data', async () => {
    const alert = answerConfirm('destructive');
    const { api, onRevoked } = await renderDetail();
    await fireEvent.press(screen.getByTestId('consents.detail.revoke'));

    expect(alert.mock.calls[0]![0]).toBe('¿Revocar el acceso de Banco Demo?');
    expect(await screen.findByText('Fynk ya no recibirá datos de Banco Demo.')).toBeOnTheScreen();
    expect(api.revoke).toHaveBeenCalledWith('c-1');
    expect(await screen.findByText('Revocado')).toBeOnTheScreen();
    expect(screen.queryByTestId('consents.detail.revoke')).toBeNull();
    // M5 deletes the link token from this notice.
    expect(onRevoked).toHaveBeenCalledWith({
      consentId: 'c-1',
      provider: 'banco-demo',
      revokedAt: NOW,
    });
  });

  it('does nothing when the person cancels', async () => {
    answerConfirm('cancel');
    const { api } = await renderDetail();
    await fireEvent.press(screen.getByTestId('consents.detail.revoke'));
    expect(api.revoke).not.toHaveBeenCalled();
    expect(screen.getByText('Activo')).toBeOnTheScreen();
  });

  it('runs the installed identity check, and does not revoke when it fails', async () => {
    answerConfirm('destructive');
    const identityCheck = jest.fn(async () => false);
    const { api } = await renderDetail({ identityCheck });
    await fireEvent.press(screen.getByTestId('consents.detail.revoke'));
    await waitFor(() =>
      expect(identityCheck).toHaveBeenCalledWith({
        reason: 'revoke_consent',
        entity: 'Banco Demo',
      }),
    );
    expect(api.revoke).not.toHaveBeenCalled();
  });

  it('revokes once the installed identity check passes', async () => {
    answerConfirm('destructive');
    const { api } = await renderDetail({ identityCheck: async () => true });
    await fireEvent.press(screen.getByTestId('consents.detail.revoke'));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('c-1'));
  });

  it.each([
    [
      new ApiError({ status: 409, code: 'consent_not_revocable', title: 'Conflict' }),
      t.revoke.errors.ended,
    ],
    [ApiError.network(), t.revoke.errors.network],
    [new ApiError({ status: 500, code: 'internal', title: 'Internal' }), t.revoke.errors.unknown],
  ])('shows the error of a refused revocation (%s)', async (error, message) => {
    answerConfirm('destructive');
    const { onRevoked } = await renderDetail({
      revoke: async () => {
        throw error;
      },
    });
    await fireEvent.press(screen.getByTestId('consents.detail.revoke'));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(onRevoked).not.toHaveBeenCalled();
  });
});

describe('Cuentas conectadas for M13', () => {
  async function renderSection(options: Options = {}) {
    const ctx = setup(options);
    const Section = createConnectedAccountsSection(ctx.deps);
    await render(
      <ThemeProvider initialPreference="light" store={noStore}>
        <QueryClientProvider client={ctx.client}>
          <Section />
        </QueryClientProvider>
      </ThemeProvider>,
    );
    return ctx;
  }

  it('lists the live consents with Revocar, which revokes at once', async () => {
    answerConfirm('destructive');
    const { api } = await renderSection();
    expect(await screen.findByText('Cuentas conectadas')).toBeOnTheScreen();
    expect(screen.getByText('Acceso de solo lectura')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('consents.row.c-1.revoke'));
    expect(await screen.findByText('Fynk ya no recibirá datos de Banco Demo.')).toBeOnTheScreen();
    expect(api.revoke).toHaveBeenCalledWith('c-1');
    await waitFor(() => expect(screen.queryByTestId('consents.row.c-1')).toBeNull());
  });

  it('renders nothing without a live consent', async () => {
    const { api } = await renderSection({ consent: revokedNow });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(screen.queryByTestId('consents.connected')).toBeNull();
  });
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('draws the page and the red revoke button from the theme', async () => {
    await renderDetail({ scheme });
    const colors = themeColors();
    expect(colors.background).toBe(scheme === 'light' ? '#FFFFFF' : '#13212D');
    expect(screen.getByTestId('consents.detailScreen')).toHaveStyle({
      backgroundColor: colors.background,
    });
    expect(screen.getByTestId('consents.detail.revoke')).toHaveStyle({
      borderColor: colors.dangerBorder,
    });
  });
});
