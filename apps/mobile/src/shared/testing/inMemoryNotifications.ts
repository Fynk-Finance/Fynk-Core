// In-memory NotificationsPort for tests. Keeps an inbox and a list of scheduled
// notifications, and lets a test fire the scheduled ones that are due.
// Test-only: never import this file from app code.
import type { IsoDateTime } from '../domain/types';
import type {
  NotificationKind,
  NotificationsPort,
  NotifyInput,
  ScheduleInput,
} from '../ports/notifications';

export interface InboxEntry extends NotifyInput {
  receivedAt: IsoDateTime;
}

export interface InMemoryNotifications extends NotificationsPort {
  inbox(): InboxEntry[];
  scheduled(): ScheduleInput[];
  setEnabled(kind: NotificationKind, enabled: boolean): void;
  /** Moves every scheduled notification with fireAt <= now into the inbox. */
  fireDue(now: IsoDateTime): void;
}

export function createInMemoryNotifications(
  now: () => IsoDateTime = () => new Date(0).toISOString(),
): InMemoryNotifications {
  const inbox: InboxEntry[] = [];
  const scheduled = new Map<string, ScheduleInput>();
  const seenDedupeKeys = new Set<string>();
  const disabled = new Set<NotificationKind>();

  const deliver = (n: NotifyInput, receivedAt: IsoDateTime) => {
    if (disabled.has(n.kind) || seenDedupeKeys.has(n.dedupeKey)) return;
    seenDedupeKeys.add(n.dedupeKey);
    const { kind, title, body, deepLink, dedupeKey } = n;
    inbox.push({ kind, title, body, deepLink, dedupeKey, receivedAt });
  };

  return {
    async notify(n) {
      deliver(n, now());
    },
    async schedule(n) {
      scheduled.set(n.id, n); // scheduling the same id again replaces it
    },
    async cancel(id) {
      scheduled.delete(id);
    },
    async isEnabled(kind) {
      return !disabled.has(kind);
    },
    inbox() {
      return [...inbox];
    },
    scheduled() {
      return [...scheduled.values()];
    },
    setEnabled(kind, enabled) {
      if (enabled) disabled.delete(kind);
      else disabled.add(kind);
    },
    fireDue(at) {
      const due = [...scheduled.values()]
        .filter((n) => Date.parse(n.fireAt) <= Date.parse(at))
        .sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt));
      for (const n of due) {
        scheduled.delete(n.id);
        deliver(n, n.fireAt);
      }
    },
  };
}
