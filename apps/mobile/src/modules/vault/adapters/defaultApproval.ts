// The old phone's device approval, wired to the Keychain, the API, identity and M12's inbox.
// identity/index.ts imports the vault, and notifications imports the vault too, so both are only
// called inside functions here, never while this file loads.
import { getRandomBytes } from 'expo-crypto';
import { AppState, type AppStateStatus } from 'react-native';

import { appEvents } from '@shared/events/appEvents';
import type { NotificationsPort } from '@shared/ports/notifications';

import { deviceId, reauthenticate } from '@modules/identity';

import { createApprovalNotifier } from '../application/approvalNotifier';
import { createApproveDeviceService } from '../application/approveDevice';
import { vaultStrings } from '../ui/strings.es-CO';
import { createDeviceApprovalsApi } from './api/deviceApprovalsApi';
import { createConfirmOwner } from './confirmOwner';
import { createKeyAgreement } from './crypto/x25519KeyAgreement';
import { createDekStore } from './keychain/dekStore';

export const deviceApprovalsApi = createDeviceApprovalsApi(() => deviceId());

export const approveDevice = createApproveDeviceService({
  api: deviceApprovalsApi,
  randomBytes: getRandomBytes,
  keys: createKeyAgreement(),
  confirmOwner: createConfirmOwner({
    dekStore: createDekStore(),
    reauthenticate: () => reauthenticate(),
    biometricPrompt: vaultStrings.approve.prompt,
  }),
});

// M12 is loaded on the first notice, because it imports this module while it loads.
const lazyNotifications: Pick<NotificationsPort, 'notify'> = {
  notify: async (n) => (await import('@modules/notifications')).notificationsPort.notify(n),
};

const approvalNotifier = createApprovalNotifier({
  service: approveDevice,
  notifications: lazyNotifications,
  events: appEvents,
  watchForeground: (listener) => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') listener();
    });
    return () => subscription.remove();
  },
  nowMs: () => Date.now(),
  text: vaultStrings.approve.notification,
});

/** Starts the in-app notice. Called once, when the vault module loads. */
export const startApprovalNotifier = (): (() => void) => approvalNotifier.start();
