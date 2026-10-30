// Detalle de cuenta (HU-013 SCRUM-27, HU-019 SCRUM-33): basic data, balance and last update,
// credit data of cards, only 4 digits, page dots to change account, close, both themes.
import {
  NavigationContainer,
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createFixedClock } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import type { Account } from '@shared/domain/types';
import { sortAccounts } from '../domain/netWorth';
import { account, card, cash, cdt, savings, wallet } from '../testing/fixtures';
import {
  ACCOUNT_DETAIL_ROUTE,
  createAccountDetailScreen,
  shortDay,
  swipeTarget,
  updatedLabel,
} from './AccountDetailScreen';

const noStore = { load: async () => 'system' as const, save: async () => undefined };
const Stack = createNativeStackNavigator();
// 5 minutes after the fixtures' last sync.
const clock = createFixedClock('2026-10-27T12:05:00Z');

function Home({ accountId }: { accountId: string }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  return (
    <Pressable onPress={() => navigation.navigate(ACCOUNT_DETAIL_ROUTE, { accountId })}>
      <Text>open</Text>
    </Pressable>
  );
}

async function renderDetail(
  accountId: string,
  opts: { accounts?: Account[]; theme?: ThemePreference; movements?: jest.Mock } = {},
) {
  const Detail = createAccountDetailScreen({
    useAccounts: () => ({
      data: {
        accounts: sortAccounts(opts.accounts ?? [savings, wallet, card, cdt, cash]),
        balanceTotalMinor: 0,
        connectedCount: 0,
      },
    }),
    clock,
    renderTransactions: opts.movements,
  });
  await render(
    <GestureHandlerRootView>
      <ThemeProvider initialPreference={opts.theme ?? 'light'} store={noStore}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home">{() => <Home accountId={accountId} />}</Stack.Screen>
            <Stack.Screen name={ACCOUNT_DETAIL_ROUTE} component={Detail} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  await fireEvent.press(screen.getByText('open'));
}

const cardFace = () => screen.getByTestId('accounts.detail.card');

describe('Detalle de cuenta', () => {
  it('shows the entity, type, balance, masked number and last update (HU-013)', async () => {
    await renderDetail('acc-ahorros');
    expect(cardFace()).toHaveTextContent(
      /Banco Demo.*Cuenta de ahorros.*Simulado.*Saldo disponible.*\$3\.200\.000.*•• 4821.*Actualizado hace 5 min/,
    );
    expect(screen.getByText('Mis cuentas')).toBeTruthy();
  });

  it('shows cupo disponible, cupo total and the payment date of a card (HU-019)', async () => {
    await renderDetail('acc-card');
    expect(cardFace()).toHaveTextContent(
      /Tarjeta de crédito.*Cupo disponible.*\$4\.500\.000.*•• 3312/,
    );
    expect(screen.getByTestId('accounts.detail.credit')).toHaveTextContent(
      /Cupo total.*\$5\.000\.000.*Pago el 5 nov/,
    );
  });

  it('shows cash as registered by hand, without number, update or Simulado', async () => {
    await renderDetail('acc-cash');
    expect(cardFace()).toHaveTextContent(
      /^EEfectivoRegistrado manualmenteSaldo disponible\$600\.000$/,
    );
    expect(screen.queryByTestId('accounts.detail.credit')).toBeNull();
  });

  it('changes account with the page dots, one per account without CDTs', async () => {
    await renderDetail('acc-ahorros');
    expect(screen.getAllByLabelText(/^Ver /)).toHaveLength(4);
    await fireEvent.press(screen.getByLabelText('Ver Billetera Demo'));
    expect(cardFace()).toHaveTextContent(/Billetera Demo.*Billetera digital.*\$4\.600\.000/);
  });

  it('closes with the chevron', async () => {
    await renderDetail('acc-ahorros');
    await fireEvent.press(screen.getByLabelText('Cerrar detalle de cuenta'));
    expect(screen.queryByTestId('accounts.detail.card')).toBeNull();
    expect(screen.getByText('open')).toBeTruthy();
  });

  it('says so when the account is gone, for example after a revoked consent', async () => {
    await renderDetail('acc-ahorros', { accounts: [] });
    expect(screen.getByText('Esta cuenta ya no está conectada.')).toBeTruthy();
  });

  it('never shows more than the last 4 digits', async () => {
    const leaky = account({ id: 'acc-leaky', providerAccountId: 'leaky', last4: '1234567890' });
    await renderDetail('acc-leaky', { accounts: [leaky] });
    expect(cardFace()).toHaveTextContent(/•• 7890/);
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/123456/);
  });

  it('gives M7 the account to list its movements', async () => {
    const movements = jest.fn(() => <Text>movimientos</Text>);
    await renderDetail('acc-wallet', { movements });
    expect(movements).toHaveBeenLastCalledWith('acc-wallet');
    expect(screen.getByText('movimientos')).toBeTruthy();
  });

  it('renders in the dark theme', async () => {
    await renderDetail('acc-ahorros', { theme: 'dark' });
    expect(screen.getByTestId('accounts.detail.amount')).toHaveTextContent('$3.200.000');
  });
});

describe('labels and swipe', () => {
  const now = new Date('2026-10-27T12:00:00Z');

  it('says how long ago the account synced', () => {
    expect(updatedLabel('2026-10-27T11:59:40Z', now)).toBe('Actualizado hace un momento');
    expect(updatedLabel('2026-10-27T11:55:00Z', now)).toBe('Actualizado hace 5 min');
    expect(updatedLabel('2026-10-27T09:00:00Z', now)).toBe('Actualizado hace 3 h');
    // 25 Oct, 22:00 in Bogotá
    expect(updatedLabel('2026-10-26T03:00:00Z', now)).toBe('Actualizado el 25 oct');
    expect(updatedLabel(null, now)).toBeNull();
  });

  it('writes short days in Spanish', () => {
    expect(shortDay('2026-11-05')).toBe('5 nov');
    expect(shortDay('2026-01-31')).toBe('31 ene');
  });

  it('moves one account per swipe and stops at the ends', () => {
    expect(swipeTarget(0, 4, -60)).toBe(1);
    expect(swipeTarget(1, 4, 60)).toBe(0);
    expect(swipeTarget(0, 4, 60)).toBe(0);
    expect(swipeTarget(3, 4, -60)).toBe(3);
    expect(swipeTarget(2, 4, 20)).toBe(2);
  });
});
