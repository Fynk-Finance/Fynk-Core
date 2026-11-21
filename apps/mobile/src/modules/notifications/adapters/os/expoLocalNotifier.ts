// LocalNotifier on expo-notifications: local notifications scheduled on the phone, which fire
// with the app closed. Nothing here registers the phone with a push service (architecture
// rule 4): the module only schedules and cancels its own notifications.
//
// Lock screen privacy (M12 prompt): amounts never show while the phone is locked.
// * Android: the channel is VISIBILITY_PRIVATE, so a secure lock screen hides the content.
// * iOS: the category sets hiddenPreviewsBodyPlaceholder ("Abre Fynk para ver el detalle.").
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import type { LocalNotifier, OsPermission } from '../../application/ports';
import { notificationsStrings } from '../../ui/strings.es-CO';

export const CHANNEL_ID = 'fynk-reminders';
export const CATEGORY_ID = 'fynk-private';

const t = notificationsStrings;

/** The short explanation before the OS prompt. Resolves true on "Continuar". */
export function explainPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t.permission.title,
      t.permission.message,
      [
        { text: t.permission.later, style: 'cancel', onPress: () => resolve(false) },
        { text: t.permission.allow, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function toPermission(status: Notifications.NotificationPermissionsStatus): OsPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

export function createExpoLocalNotifier(
  explain: () => Promise<boolean> = explainPermission,
): LocalNotifier {
  let ready: Promise<void> | null = null;

  /** Channel and category, created once before the first notification. */
  const prepare = () => {
    ready ??= (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: t.lockScreen.channelName,
          importance: AndroidImportance.DEFAULT,
          lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
        });
      } else {
        await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [], {
          previewPlaceholder: t.lockScreen.hiddenBody,
        });
      }
    })().catch((error: unknown) => {
      ready = null; // try again next time
      throw error;
    });
    return ready;
  };

  return {
    async permission() {
      return toPermission(await Notifications.getPermissionsAsync());
    },

    async askPermission() {
      if (!(await explain())) return false;
      const status = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      return status.granted;
    },

    async schedule(request) {
      await prepare();
      return Notifications.scheduleNotificationAsync({
        content: {
          title: request.title,
          body: request.body,
          data: request.data,
          categoryIdentifier: CATEGORY_ID,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: request.fireAt,
          channelId: CHANNEL_ID,
        },
      });
    },

    async cancel(osId) {
      await Notifications.cancelScheduledNotificationAsync(osId);
    },
  };
}

/**
 * While the app is open: show the notification as a banner, move it into the inbox when it
 * fires, and open its link when the person taps it (also when the tap opened the app).
 * Returns a function that removes the listeners.
 */
export function startLocalNotificationListeners(handlers: {
  onFired: () => void;
  onTapped: (deepLink: string) => void;
}): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const linkOf = (response: Notifications.NotificationResponse) => {
    const link = response.notification.request.content.data?.deepLink;
    return typeof link === 'string' ? link : null;
  };
  const onResponse = (response: Notifications.NotificationResponse) => {
    handlers.onFired();
    const link = linkOf(response);
    if (link) handlers.onTapped(link);
  };
  const received = Notifications.addNotificationReceivedListener(() => handlers.onFired());
  const tapped = Notifications.addNotificationResponseReceivedListener(onResponse);
  // A tap that launched the app arrived before these listeners existed.
  void Notifications.getLastNotificationResponseAsync()
    .then((last) => {
      if (last) {
        onResponse(last);
        return Notifications.clearLastNotificationResponseAsync();
      }
      return undefined;
    })
    .catch(() => undefined);
  return () => {
    received.remove();
    tapped.remove();
  };
}
