// The expo-notifications adapter: lock screen privacy, the date trigger, permissions and the
// listeners. expo-notifications is native, so it is replaced by a Jest mock.
import { Alert, Platform } from 'react-native';

import * as Notifications from 'expo-notifications';

import {
  CATEGORY_ID,
  CHANNEL_ID,
  createExpoLocalNotifier,
  explainPermission,
  startLocalNotificationListeners,
} from './expoLocalNotifier';

jest.mock('expo-notifications', () => {
  const listeners: Record<string, ((e: unknown) => void)[]> = { received: [], response: [] };
  return {
    AndroidImportance: { DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 2 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationChannelAsync: jest.fn(async () => null),
    setNotificationCategoryAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(async () => 'os-1'),
    cancelScheduledNotificationAsync: jest.fn(async () => undefined),
    setNotificationHandler: jest.fn(),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
    addNotificationReceivedListener: jest.fn((fn: (e: unknown) => void) => {
      listeners.received!.push(fn);
      return { remove: jest.fn() };
    }),
    addNotificationResponseReceivedListener: jest.fn((fn: (e: unknown) => void) => {
      listeners.response!.push(fn);
      return { remove: jest.fn() };
    }),
    __listeners: listeners,
  };
});

const mocked = Notifications as jest.Mocked<typeof Notifications> & {
  __listeners: Record<string, ((e: unknown) => void)[]>;
};

const request = {
  title: 'Servicios públicos',
  body: 'Vence en 2 días: $186.000.',
  fireAt: new Date('2026-10-28T14:00:00Z'),
  data: { scheduledId: 'reminder:r1', deepLink: 'fynk://billetera/recurrentes/r1' },
};

function setPlatform(os: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.__listeners.received = [];
  mocked.__listeners.response = [];
});

describe('createExpoLocalNotifier', () => {
  it('on Android, schedules in a private channel so a locked phone hides the amount', async () => {
    setPlatform('android');
    const notifier = createExpoLocalNotifier(async () => true);

    expect(await notifier.schedule(request)).toBe('os-1');
    await notifier.schedule(request);

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledTimes(1); // created once
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.objectContaining({ lockscreenVisibility: 2 }),
    );
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Servicios públicos',
        body: 'Vence en 2 días: $186.000.',
        data: request.data,
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: { type: 'date', date: request.fireAt, channelId: CHANNEL_ID },
    });
  });

  it('on iOS, sets the placeholder shown instead of the body when previews are hidden', async () => {
    setPlatform('ios');
    await createExpoLocalNotifier(async () => true).schedule(request);
    expect(mocked.setNotificationCategoryAsync).toHaveBeenCalledWith(CATEGORY_ID, [], {
      previewPlaceholder: 'Abre Fynk para ver el detalle.',
    });
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('maps the OS permission: granted, can ask again, or denied for good', async () => {
    const notifier = createExpoLocalNotifier(async () => true);
    const status = (granted: boolean, canAskAgain: boolean) =>
      ({ granted, canAskAgain }) as Notifications.NotificationPermissionsStatus;
    mocked.getPermissionsAsync.mockResolvedValueOnce(status(true, true));
    expect(await notifier.permission()).toBe('granted');
    mocked.getPermissionsAsync.mockResolvedValueOnce(status(false, true));
    expect(await notifier.permission()).toBe('undetermined');
    mocked.getPermissionsAsync.mockResolvedValueOnce(status(false, false));
    expect(await notifier.permission()).toBe('denied');
  });

  it('shows the OS prompt only after "Continuar" on the explanation', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({
      granted: true,
    } as Notifications.NotificationPermissionsStatus);
    expect(await createExpoLocalNotifier(async () => false).askPermission()).toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

    expect(await createExpoLocalNotifier(async () => true).askPermission()).toBe(true);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels by OS id', async () => {
    await createExpoLocalNotifier().cancel('os-9');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('os-9');
  });
});

describe('explainPermission', () => {
  it('explains in Spanish and resolves with the button the person taps', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Continuar')?.onPress?.();
    });
    await expect(explainPermission()).resolves.toBe(true);
    expect(alert.mock.calls[0]?.[0]).toBe('Activa los recordatorios');
    expect(alert.mock.calls[0]?.[1]).toMatch(/no se ven los montos/);

    alert.mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Ahora no')?.onPress?.();
    });
    await expect(explainPermission()).resolves.toBe(false);
    alert.mockRestore();
  });
});

describe('startLocalNotificationListeners', () => {
  const response = (deepLink: unknown) => ({
    notification: { request: { content: { data: { deepLink } } } },
  });

  it('moves a fired reminder into the inbox and opens the link of a tapped one', () => {
    const onFired = jest.fn();
    const onTapped = jest.fn();
    startLocalNotificationListeners({ onFired, onTapped });

    mocked.__listeners.received![0]!({});
    expect(onFired).toHaveBeenCalledTimes(1);

    mocked.__listeners.response![0]!(response('fynk://metas/g1'));
    expect(onFired).toHaveBeenCalledTimes(2);
    expect(onTapped).toHaveBeenCalledWith('fynk://metas/g1');

    mocked.__listeners.response![0]!(response(42));
    expect(onTapped).toHaveBeenCalledTimes(1); // no valid link
  });

  it('handles the tap that opened the app before the listeners existed', async () => {
    mocked.getLastNotificationResponseAsync.mockResolvedValueOnce(
      response('fynk://billetera') as unknown as Notifications.NotificationResponse,
    );
    const onTapped = jest.fn();
    startLocalNotificationListeners({ onFired: jest.fn(), onTapped });
    await new Promise((r) => setTimeout(r, 0));
    expect(onTapped).toHaveBeenCalledWith('fynk://billetera');
    expect(mocked.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('shows reminders as banners while the app is open, without sound or badge', async () => {
    startLocalNotificationListeners({ onFired: jest.fn(), onTapped: jest.fn() });
    const handler = mocked.setNotificationHandler.mock.calls[0]?.[0];
    await expect(handler?.handleNotification({} as Notifications.Notification)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  it('removes both listeners', () => {
    const stop = startLocalNotificationListeners({ onFired: jest.fn(), onTapped: jest.fn() });
    stop();
    const [received] = mocked.addNotificationReceivedListener.mock.results;
    const [tapped] = mocked.addNotificationResponseReceivedListener.mock.results;
    expect((received?.value as { remove: jest.Mock }).remove).toHaveBeenCalled();
    expect((tapped?.value as { remove: jest.Mock }).remove).toHaveBeenCalled();
  });
});
