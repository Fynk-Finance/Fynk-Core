// Aprobar nuevo dispositivo: polling, approve, reject and each message, in light and dark.
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFixedClock } from '@shared/testing';
import { ThemeProvider, useTheme, type ThemePreference } from '@shared/ui';

import type {
  ApproveDeviceService,
  ApproveResult,
  RejectResult,
  ApprovalRequestView,
} from '../application/approveDevice';
import { ApprovalError } from '../application/ports';
import {
  POLL_INTERVAL_MS,
  createApproveDeviceScreen,
  minutesLeft,
  splitCode,
} from './ApproveDeviceScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.approve;
const noStore = { load: async () => 'system' as const, save: async () => undefined };
const NOW = '2026-10-30T15:00:00Z';

const request = (over: Partial<ApprovalRequestView> = {}): ApprovalRequestView => ({
  id: 'r1',
  deviceName: 'Pixel de Camila',
  platform: 'android',
  newDevicePublicKey: new Uint8Array(32),
  createdAt: NOW,
  expiresAt: '2026-10-30T15:07:30Z',
  code: '482915',
  ...over,
});

function Probe() {
  const { colors } = useTheme();
  return <Text testID="probe.background">{colors.background}</Text>;
}

const Stack = createNativeStackNavigator();
const Other = () => <Text>other screen</Text>;

async function renderScreen(
  options: {
    list?: () => Promise<ApprovalRequestView[]>;
    approve?: ApproveResult;
    reject?: RejectResult;
    preference?: ThemePreference;
  } = {},
) {
  const service = {
    listPending: jest.fn(options.list ?? (async () => [request()])),
    approve: jest.fn(async () => options.approve ?? ('approved' as ApproveResult)),
    reject: jest.fn(async () => options.reject ?? ('rejected' as RejectResult)),
  } satisfies ApproveDeviceService;
  const Approve = createApproveDeviceScreen({
    service,
    clock: createFixedClock(NOW),
    securityRoute: 'identity.Security',
  });
  await render(
    <ThemeProvider initialPreference={options.preference ?? 'light'} store={noStore}>
      <Probe />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="vault.ApproveDevice" component={Approve} />
          <Stack.Screen name="identity.Security" component={Other} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>,
  );
  await act(async () => undefined);
  return service;
}

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  jest.useRealTimers();
});

const tick = (ms: number) => act(async () => jest.advanceTimersByTimeAsync(ms));

it('splits the code and counts minutes', () => {
  expect(splitCode('048291')).toBe('048 291');
  expect(minutesLeft('2026-10-30T15:07:30Z', new Date(NOW))).toBe(8);
  expect(minutesLeft('2026-10-30T14:59:00Z', new Date(NOW))).toBe(1);
});

describe.each(['light', 'dark'] as const)('in %s', (preference) => {
  it('shows a request with the device, the code and the buttons', async () => {
    await renderScreen({ preference });
    expect(screen.getByRole('header', { name: t.title })).toBeOnTheScreen();
    const card = screen.getByTestId('vault.approve.card.r1');
    expect(within(card).getByText('Pixel de Camila')).toBeOnTheScreen();
    expect(within(card).getByText('Android')).toBeOnTheScreen();
    expect(within(card).getByTestId('vault.approve.code')).toHaveTextContent('482 915');
    expect(within(card).getByText(t.codeLabel)).toBeOnTheScreen();
    expect(within(card).getByText('Vence en 8 min')).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: t.approve })).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: t.reject })).toBeOnTheScreen();
    expect(screen.getByLabelText(`${t.codeLabel}. 4 8 2 9 1 5`)).toBeOnTheScreen();
  });

  it('paints with the theme of the phone', async () => {
    await renderScreen({ preference });
    expect(screen.getByTestId('probe.background')).toHaveTextContent(
      preference === 'dark' ? '#13212D' : '#FFFFFF',
    );
  });
});

it('shows iPhone for an iOS device', async () => {
  await renderScreen({ list: async () => [request({ platform: 'ios' })] });
  expect(screen.getByText('iPhone')).toBeOnTheScreen();
});

it('says there is nothing to approve', async () => {
  await renderScreen({ list: async () => [] });
  expect(screen.getByText(t.empty)).toBeOnTheScreen();
  expect(screen.queryByTestId('vault.approve.approve')).toBeNull();
});

describe('polling', () => {
  it('looks every 5 seconds and shows new requests', async () => {
    let calls = 0;
    const service = await renderScreen({
      list: async () => (++calls < 2 ? [] : [request()]),
    });
    expect(service.listPending).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.empty)).toBeOnTheScreen();
    await tick(POLL_INTERVAL_MS);
    expect(service.listPending).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('vault.approve.card.r1')).toBeOnTheScreen();
    await tick(POLL_INTERVAL_MS);
    expect(service.listPending).toHaveBeenCalledTimes(3);
  });

  it('stops when the screen loses focus', async () => {
    const service = await renderScreen();
    await fireEvent.press(screen.getByTestId('vault.approve.devices'));
    await act(async () => undefined);
    expect(screen.getByText('other screen')).toBeOnTheScreen();
    const calls = service.listPending.mock.calls.length;
    await tick(POLL_INTERVAL_MS * 3);
    expect(service.listPending).toHaveBeenCalledTimes(calls);
  });

  it('stops on unmount', async () => {
    const service = await renderScreen();
    await screen.unmount();
    await tick(POLL_INTERVAL_MS * 3);
    expect(service.listPending).toHaveBeenCalledTimes(1);
  });

  it('shows the offline message and clears it when the connection returns', async () => {
    let fail = true;
    await renderScreen({
      list: async () => {
        if (fail) throw new ApprovalError('offline');
        return [request()];
      },
    });
    expect(screen.getByText(t.messages.offline)).toBeOnTheScreen();
    fail = false;
    await tick(POLL_INTERVAL_MS);
    expect(screen.queryByText(t.messages.offline)).toBeNull();
    expect(screen.getByTestId('vault.approve.card.r1')).toBeOnTheScreen();
  });
});

describe('approve', () => {
  it('approves, says so and looks again', async () => {
    let approved = false;
    const service = await renderScreen({ list: async () => (approved ? [] : [request()]) });
    service.approve.mockImplementationOnce(async () => {
      approved = true;
      return 'approved';
    });
    await fireEvent.press(screen.getByTestId('vault.approve.approve'));
    await act(async () => undefined);
    expect(service.approve).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    expect(screen.getByText(t.messages.approved)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.approve.card.r1')).toBeNull();
  });

  it('shows a busy state and disables both buttons while approving', async () => {
    let finish: (r: ApproveResult) => void = () => undefined;
    const service = await renderScreen();
    service.approve.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    await fireEvent.press(screen.getByTestId('vault.approve.approve'));
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: t.busy })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.reject })).toBeDisabled();
    await act(async () => finish('approved'));
    expect(screen.getByText(t.messages.approved)).toBeOnTheScreen();
  });

  it('shows nothing when the person cancels the check', async () => {
    const service = await renderScreen({ approve: 'cancelled' });
    await fireEvent.press(screen.getByTestId('vault.approve.approve'));
    await act(async () => undefined);
    expect(service.approve).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('vault.approve.notice')).toBeNull();
    expect(screen.getByTestId('vault.approve.card.r1')).toBeOnTheScreen();
  });

  it.each([
    ['expired', t.messages.expired],
    ['notPending', t.messages.notPending],
    ['offline', t.messages.offline],
    ['failed', t.messages.failed],
  ] as const)('shows the message for %s', async (result, text) => {
    await renderScreen({ approve: result });
    await fireEvent.press(screen.getByTestId('vault.approve.approve'));
    await act(async () => undefined);
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByTestId('vault.approve.notice')).toBeOnTheScreen();
  });

  it('keeps the message after the list refreshes', async () => {
    await renderScreen({ approve: 'expired' });
    await fireEvent.press(screen.getByTestId('vault.approve.approve'));
    await act(async () => undefined);
    await tick(POLL_INTERVAL_MS);
    expect(screen.getByText(t.messages.expired)).toBeOnTheScreen();
  });
});

describe('reject', () => {
  it('rejects and says so', async () => {
    let rejected = false;
    const service = await renderScreen({ list: async () => (rejected ? [] : [request()]) });
    service.reject.mockImplementationOnce(async () => {
      rejected = true;
      return 'rejected';
    });
    await fireEvent.press(screen.getByTestId('vault.approve.reject'));
    await act(async () => undefined);
    expect(service.reject).toHaveBeenCalledWith('r1');
    expect(screen.getByText(t.messages.rejected)).toBeOnTheScreen();
    expect(screen.queryByTestId('vault.approve.card.r1')).toBeNull();
  });

  it('shows the error when it fails', async () => {
    await renderScreen({ reject: 'offline' });
    await fireEvent.press(screen.getByTestId('vault.approve.reject'));
    await act(async () => undefined);
    expect(screen.getByText(t.messages.offline)).toBeOnTheScreen();
  });
});

it('links to the linked devices', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole('link', { name: t.devices }));
  await act(async () => undefined);
  expect(screen.getByText('other screen')).toBeOnTheScreen();
});
