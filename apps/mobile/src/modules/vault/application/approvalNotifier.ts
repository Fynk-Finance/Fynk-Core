// In-app notice for a new device waiting for approval (HU-046). The old phone looks for requests
// when the vault opens and when the app returns to the foreground, and puts one inbox entry per
// request. No background work and no server push (architecture rule 4). Errors are swallowed:
// the Seguridad screen and the approval screen still show the requests.
import type { AppEvents } from '@shared/events/appEvents';
import type { NotificationsPort } from '@shared/ports/notifications';

import type { ApproveDeviceService } from './approveDevice';

/** fynk://boveda/aprobar, the path of `vault.ApproveDevice` under the vault's reserved prefix. */
export const APPROVE_DEVICE_DEEP_LINK = 'fynk://boveda/aprobar';

/** The app returned to the foreground and checking again is allowed once a minute. */
export const MIN_CHECK_INTERVAL_MS = 60_000;

export interface ApprovalNoticeText {
  title: string;
  body: (deviceName: string) => string;
}

export interface ApprovalNotifierDeps {
  service: Pick<ApproveDeviceService, 'listPending'>;
  /** Only notify is needed. The wiring loads M12 lazily (it imports the vault). */
  notifications: Pick<NotificationsPort, 'notify'>;
  events: Pick<AppEvents, 'on'>;
  /** Calls the listener each time the app comes back to the foreground. Returns the unsubscribe. */
  watchForeground: (listener: () => void) => () => void;
  nowMs: () => number;
  text: ApprovalNoticeText;
}

export interface ApprovalNotifier {
  /** Returns the unsubscribe. */
  start(): () => void;
}

export function createApprovalNotifier(deps: ApprovalNotifierDeps): ApprovalNotifier {
  return {
    start() {
      let unlocked = false;
      let lastCheck: number | null = null;

      const check = async () => {
        try {
          const requests = await deps.service.listPending();
          if (!unlocked) return;
          // device_approval is always on in M12, so there is no isEnabled check: a security notice
          // must not depend on a switch. The dedupe key keeps one entry per request.
          for (const r of requests) {
            await deps.notifications.notify({
              kind: 'device_approval',
              title: deps.text.title,
              body: deps.text.body(r.deviceName),
              deepLink: APPROVE_DEVICE_DEEP_LINK,
              dedupeKey: `device-approval:${r.id}`,
            });
          }
        } catch {
          // Nothing about the requests may reach a log.
        }
      };

      const offUnlocked = deps.events.on('vault.unlocked', () => {
        unlocked = true;
        lastCheck = deps.nowMs();
        void check();
      });
      const offLocked = deps.events.on('vault.locked', () => {
        unlocked = false;
      });
      const offForeground = deps.watchForeground(() => {
        if (!unlocked) return;
        const now = deps.nowMs();
        if (lastCheck !== null && now - lastCheck < MIN_CHECK_INTERVAL_MS) return;
        lastCheck = now;
        void check();
      });

      return () => {
        offUnlocked();
        offLocked();
        offForeground();
      };
    },
  };
}
