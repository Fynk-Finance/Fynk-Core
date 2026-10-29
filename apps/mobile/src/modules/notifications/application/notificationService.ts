// The notifications center: implements the shared NotificationsPort (contracts 3.4) and the
// inbox actions of the Notificaciones screen. Everything lives in the vault. There is no server
// push: modules call notify() after a sync with the app open, and schedule() for reminders.
//
// schedule() stores the reminder and asks the phone for a local notification at its time, which
// fires even with the app closed. deliverDue() moves the ones whose time has passed into the
// inbox when the app opens, so they appear even if the person never tapped the OS notification.
import type { Clock, Id, IsoDateTime } from '@shared/domain/types';
import type { NotificationKind, NotificationsPort, NotifyInput } from '@shared/ports';

import { idsOverLimit, INBOX_LIMIT, type InboxItem } from '../domain/inbox';
import { ALWAYS_ON } from '../domain/kinds';
import type { InboxStore, LocalNotifier } from './ports';

export interface NotificationServiceDeps {
  /** The vault store. Throws VaultLockedError while the vault is locked. */
  store: () => InboxStore;
  clock: Clock;
  newId: () => Id;
  inboxLimit?: number;
  /** The phone's local notifications. Without it, reminders only reach the inbox. */
  notifier?: LocalNotifier;
}

export interface NotificationService extends NotificationsPort {
  list(): Promise<InboxItem[]>;
  unreadCount(): Promise<number>;
  markRead(id: Id): Promise<void>;
  markAllRead(): Promise<void>;
  /** Moves every scheduled notification whose time has passed into the inbox. */
  deliverDue(): Promise<number>;
  setEnabled(kind: NotificationKind, enabled: boolean): Promise<void>;
  /** Called after every change of the inbox. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/** Same instant, one text format, so times sort and compare as text in the vault. */
function normalize(iso: IsoDateTime): IsoDateTime {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) throw new RangeError('fireAt is not a date');
  return new Date(time).toISOString();
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const limit = deps.inboxLimit ?? INBOX_LIMIT;
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  const now = () => deps.clock.now().toISOString();

  const enabled = async (store: InboxStore, kind: NotificationKind) =>
    ALWAYS_ON.has(kind) || store.isEnabled(kind);

  /** Inserts one row unless its kind is off or its dedupe key is known, then trims the inbox. */
  const deliver = async (store: InboxStore, n: NotifyInput, createdAt: IsoDateTime) => {
    if (!(await enabled(store, n.kind))) return false;
    const inserted = await store.insert({
      id: deps.newId(),
      kind: n.kind,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink,
      dedupeKey: n.dedupeKey,
      createdAt,
      readAt: null,
    });
    if (inserted) await store.deleteIds(idsOverLimit(await store.list(), limit));
    return inserted;
  };

  /**
   * The OS notification of a reminder. Permission is asked the first time something is
   * scheduled, after a short explanation. Without permission, or if the OS fails, the reminder
   * still reaches the inbox through deliverDue when the app opens.
   */
  const scheduleOs = async (r: {
    id: Id;
    title: string;
    body: string;
    deepLink: string;
    fireAt: Date;
  }): Promise<string | null> => {
    const notifier = deps.notifier;
    if (!notifier) return null;
    try {
      const permission = await notifier.permission();
      const allowed =
        permission === 'granted' ||
        (permission === 'undetermined' && (await notifier.askPermission()));
      if (!allowed) return null;
      return await notifier.schedule({
        title: r.title,
        body: r.body,
        fireAt: r.fireAt,
        data: { scheduledId: r.id, deepLink: r.deepLink },
      });
    } catch {
      return null;
    }
  };

  const cancelOs = async (store: InboxStore, id: Id) => {
    const osId = deps.notifier ? await store.scheduledOsId(id) : null;
    if (!osId || !deps.notifier) return;
    await deps.notifier.cancel(osId).catch(() => undefined);
    await store.setScheduledOsId(id, null);
  };

  return {
    async notify(n) {
      const store = deps.store();
      const inserted = await store.transaction((tx) => deliver(tx, n, now()));
      if (inserted) changed();
    },

    async schedule(n) {
      const store = deps.store();
      if (!(await enabled(store, n.kind))) return;
      const { kind, title, body, deepLink, dedupeKey } = n;
      const fireAt = normalize(n.fireAt);
      // Scheduling the same id again replaces the reminder, so its old OS notification goes.
      await cancelOs(store, n.id);
      await store.saveScheduled({
        id: n.id,
        kind,
        fireAt,
        payload: { kind, title, body, deepLink, dedupeKey },
      });
      if (Date.parse(fireAt) <= deps.clock.now().getTime()) return; // deliverDue takes it
      const osId = await scheduleOs({ title, body, fireAt: new Date(fireAt), deepLink, id: n.id });
      if (osId) await store.setScheduledOsId(n.id, osId);
    },

    async cancel(id) {
      const store = deps.store();
      await cancelOs(store, id);
      await store.deleteScheduled(id);
    },

    async isEnabled(kind) {
      return enabled(deps.store(), kind);
    },

    async setEnabled(kind, on) {
      if (ALWAYS_ON.has(kind) && !on) return;
      const store = deps.store();
      await store.setEnabled(kind, on);
      if (on) return;
      // A kind turned off stops ringing at once: its pending reminders are dropped.
      for (const id of await store.listScheduledIds(kind)) {
        await cancelOs(store, id);
        await store.deleteScheduled(id);
      }
    },

    async list() {
      return deps.store().list();
    },

    async unreadCount() {
      return deps.store().unreadCount();
    },

    async markRead(id) {
      await deps.store().markRead(id, now());
      changed();
    },

    async markAllRead() {
      await deps.store().markAllRead(now());
      changed();
    },

    async deliverDue() {
      const delivered = await deps.store().transaction(async (tx) => {
        let count = 0;
        for (const row of await tx.listDue(now())) {
          if (await deliver(tx, row.payload, row.fireAt)) count += 1;
          await tx.deleteScheduled(row.id);
        }
        return count;
      });
      if (delivered > 0) changed();
      return delivered;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
