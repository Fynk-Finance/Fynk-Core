// The consent part of Conectar banco (HU-006): scope and term shown, explicit acceptance, the
// request carries what was shown, errors, both themes.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ApiError } from '@shared/api';
import { ThemeProvider, useTheme, type ColorScheme, type Palette } from '@shared/ui';

import { scopesOf, type Consent, type ConsentProvider, type ConsentText } from '../domain/consent';
import type { ConsentsApiPort } from '../application/ports';
import { createConsentAcceptance } from './ConsentAcceptance';
import { ConsentScopeCard } from './ConsentScopeCard';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings;
const noStore = { load: async () => 'system' as const, save: async () => undefined };

const text: ConsentText = {
  version: '2026-10-v1',
  bodyMd: '# Autorización',
  sha256: '9f2c4e0b7a1d3c5e8f6a2b4d6e8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f',
  publishedAt: '2026-10-27T00:00:00Z',
  purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
  termDays: 365,
};

const bancoDemo: ConsentProvider = {
  id: 'banco-demo',
  displayName: 'Banco Demo',
  supportedScopes: ['balances', 'transactions', 'account_details'],
};
const billeteraDemo: ConsentProvider = {
  id: 'billetera-demo',
  displayName: 'Billetera Demo',
  supportedScopes: ['balances', 'transactions', 'account_details'],
};

const pending: Consent = {
  id: '01928c7e-5b1a-7c3d-9e2f-4a6b8c0d2e4f',
  provider: 'banco-demo',
  scopes: ['balances', 'transactions', 'account_details'],
  purpose: text.purpose,
  termDays: 365,
  status: 'pending',
  textVersion: '2026-10-v1',
  createdAt: '2026-10-27T15:04:05Z',
  acceptedAt: '2026-10-27T15:04:05Z',
};

interface Options {
  scheme?: ColorScheme;
  create?: ConsentsApiPort['create'];
  provider?: ConsentProvider;
  onPressPolicy?: () => void;
}

// The palette the screen was drawn with, read like any screen does.
function ProbeColors() {
  return <Text testID="probe.colors">{JSON.stringify(useTheme().colors)}</Text>;
}
const themeColors = (): Palette =>
  JSON.parse(screen.getByTestId('probe.colors').props.children as string) as Palette;

// A small host like M5's Conectar banco: the cards plus the acceptance, and a provider switch.
async function renderConsent(options: Options = {}) {
  const api = {
    currentText: jest.fn(async () => text),
    create: jest.fn(options.create ?? (async () => pending)),
  };
  const Acceptance = createConsentAcceptance({
    api,
    appVersion: '0.1.0',
    newIdempotencyKey: () => 'key-1',
  });
  const onConsentCreated = jest.fn();

  function Host() {
    const [provider, setProvider] = useState(options.provider ?? bancoDemo);
    return (
      <View>
        <Pressable testID="host.chooseWallet" onPress={() => setProvider(billeteraDemo)} />
        <ConsentScopeCard
          entityName={provider.displayName}
          scopes={scopesOf(provider)}
          text={text}
        />
        <Acceptance
          provider={provider}
          text={text}
          onConsentCreated={onConsentCreated}
          onPressPolicy={options.onPressPolicy}
        />
      </View>
    );
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  await render(
    <ThemeProvider initialPreference={options.scheme ?? 'light'} store={noStore}>
      <QueryClientProvider client={client}>
        <ProbeColors />
        <Host />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { api, onConsentCreated };
}

const button = () => screen.getByTestId('consents.goToPortal');
const checkbox = () => screen.getByTestId('consents.checkbox');
const accept = () => fireEvent.press(checkbox());
const goToPortal = () => fireEvent.press(button());

describe('HU-006: alcance y duración', () => {
  it('shows what the entity shares, what Fynk never does, and the decided footer', async () => {
    await renderConsent();
    expect(screen.getByText('Banco Demo compartirá con Fynk')).toBeOnTheScreen();
    for (const scope of ['balances', 'transactions', 'account_details'] as const) {
      expect(screen.getByText(t.scopeCard.scopes[scope].title)).toBeOnTheScreen();
      expect(screen.getByText(t.scopeCard.scopes[scope].detail)).toBeOnTheScreen();
    }
    expect(screen.getByText('Fynk nunca podrá')).toBeOnTheScreen();
    expect(screen.getByText('Ver ni guardar tu clave del banco')).toBeOnTheScreen();
    expect(screen.getByText('Mover tu dinero, hacer pagos o transferencias')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Puedes revocar el acceso cuando quieras desde Mi cuenta. Se actualizan cada vez que abres Fynk o deslizas para actualizar.',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the purpose and the term of the published text', async () => {
    await renderConsent();
    expect(
      screen.getByText(
        'Finalidad: mostrarte tus finanzas y recomendaciones dentro de Fynk. Vigencia: 12 meses.',
      ),
    ).toBeOnTheScreen();
  });

  it('lists only the scopes the entity shares', async () => {
    await renderConsent({ provider: { ...bancoDemo, supportedScopes: ['balances'] } });
    expect(screen.getByTestId('consents.scope.balances')).toBeOnTheScreen();
    expect(screen.queryByTestId('consents.scope.transactions')).toBeNull();
    expect(screen.queryByTestId('consents.scope.account_details')).toBeNull();
  });
});

describe('HU-006: registrar explícitamente', () => {
  it('starts unchecked with "Ir al portal" disabled', async () => {
    await renderConsent();
    expect(checkbox()).not.toBeChecked();
    expect(screen.getByText('Ir al portal de Banco Demo')).toBeOnTheScreen();
    expect(button()).toBeDisabled();
  });

  it('enables the button only while the box is checked', async () => {
    await renderConsent();
    await accept();
    expect(checkbox()).toBeChecked();
    expect(button()).toBeEnabled();
    await accept();
    expect(button()).toBeDisabled();
  });

  it('records nothing when the disabled button is pressed', async () => {
    const { api } = await renderConsent();
    await goToPortal();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('sends exactly what was shown, with the text hash, and hands the consent to the host', async () => {
    const { api, onConsentCreated } = await renderConsent();
    await accept();
    await goToPortal();
    await waitFor(() => expect(onConsentCreated).toHaveBeenCalledWith(pending));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      {
        provider: 'banco-demo',
        scopes: ['balances', 'transactions', 'account_details'],
        purpose: 'Mostrarte tus finanzas y recomendaciones dentro de Fynk.',
        termDays: 365,
        textVersion: '2026-10-v1',
        textSha256: text.sha256,
        appVersion: '0.1.0',
        locale: 'es-CO',
      },
      'key-1',
    );
  });

  it('asks again after another entity is chosen', async () => {
    await renderConsent();
    await accept();
    expect(button()).toBeEnabled();
    await fireEvent.press(screen.getByTestId('host.chooseWallet'));
    expect(screen.getByText('Billetera Demo compartirá con Fynk')).toBeOnTheScreen();
    expect(screen.getByText('Ir al portal de Billetera Demo')).toBeOnTheScreen();
    expect(checkbox()).not.toBeChecked();
    expect(button()).toBeDisabled();
  });

  it('opens the privacy policy from its link', async () => {
    const onPressPolicy = jest.fn();
    await renderConsent({ onPressPolicy });
    await fireEvent.press(screen.getByText(t.checkbox.policy));
    expect(onPressPolicy).toHaveBeenCalled();
  });
});

describe('errors', () => {
  const refuse =
    (code: string, status = 422) =>
    async () => {
      throw new ApiError({ status, code, title: code });
    };

  it.each([
    ['device_required', t.errors.device],
    ['unsupported_provider', t.errors.provider],
    ['idempotency_conflict', t.errors.unknown],
  ])('shows %s and keeps the box checked for a retry', async (code, message) => {
    const { onConsentCreated } = await renderConsent({ create: refuse(code) });
    await accept();
    await goToPortal();
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(checkbox()).toBeChecked();
    expect(button()).toBeEnabled();
    expect(onConsentCreated).not.toHaveBeenCalled();
  });

  it('shows the offline message when the API cannot be reached', async () => {
    await renderConsent({
      create: async () => {
        throw ApiError.network();
      },
    });
    await accept();
    await goToPortal();
    expect(await screen.findByText(t.errors.network)).toBeOnTheScreen();
  });

  it('clears the box when the text changed, so the new one is accepted explicitly', async () => {
    await renderConsent({ create: refuse('text_mismatch') });
    await accept();
    await goToPortal();
    expect(await screen.findByText(t.errors.text_changed)).toBeOnTheScreen();
    expect(checkbox()).not.toBeChecked();
    expect(button()).toBeDisabled();
  });
});

describe.each(['light', 'dark'] as const)('%s theme', (scheme) => {
  it('draws the box, the cards and the button with the theme colors', async () => {
    await renderConsent({ scheme });
    const colors = themeColors();
    expect(colors.background).toBe(scheme === 'light' ? '#FFFFFF' : '#13212D');
    expect(screen.getByTestId('consents.checkbox.box')).toHaveStyle({
      borderColor: colors.controlBorder,
      backgroundColor: colors.background,
    });
    expect(screen.getByTestId('consents.scopeCard')).toHaveStyle({
      backgroundColor: colors.background,
      borderColor: colors.borderBlue,
    });
    await accept();
    expect(screen.getByTestId('consents.checkbox.box')).toHaveStyle({
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    });
    expect(button()).toHaveStyle({ backgroundColor: colors.primary });
  });
});
