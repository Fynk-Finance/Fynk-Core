// Ports of the notifications module. The vault adapter implements InboxStore
// (adapters/vault/vaultInboxStore.ts).
import type { Id, IsoDateTime } from '@shared/domain/types';
import type { NotificationKind, NotifyInput } from '@shared/ports';

import type { InboxItem } from '../domain/inbox';

export interface NewInboxRow extends InboxItem {
  dedupeKey: string;
}

/** A notification waiting for its time (`ScheduleInput` without the id and the time). */
export interface ScheduledRow {
  id: Id;
  kind: NotificationKind;
  fireAt: IsoDateTime;
  payload: NotifyInput;
}

export interface InboxStore {
  /** Stores the row. False, and nothing stored, when its dedupe key is already in the inbox. */
  insert(row: NewInboxRow): Promise<boolean>;
  list(): Promise<InboxItem[]>;
  unreadCount(): Promise<number>;
  markRead(id: Id, at: IsoDateTime): Promise<void>;
  markAllRead(at: IsoDateTime): Promise<void>;
  deleteIds(ids: Id[]): Promise<void>;
  /** True unless the person turned the kind off. */
  isEnabled(kind: NotificationKind): Promise<boolean>;
  setEnabled(kind: NotificationKind, enabled: boolean): Promise<void>;
  /** Stores or replaces (same id) a scheduled notification. */
  saveScheduled(row: ScheduledRow): Promise<void>;
  deleteScheduled(id: Id): Promise<void>;
  /** Scheduled rows with fireAt at or before `now`, oldest first. */
  listDue(now: IsoDateTime): Promise<ScheduledRow[]>;
  /** Ids of the scheduled rows of one kind. */
  listScheduledIds(kind: NotificationKind): Promise<Id[]>;
  /** The OS notification id of a scheduled row, null when none was scheduled. */
  scheduledOsId(id: Id): Promise<string | null>;
  setScheduledOsId(id: Id, osId: string | null): Promise<void>;
  /** Runs `fn` in one vault transaction. */
  transaction<T>(fn: (store: InboxStore) => Promise<T>): Promise<T>;
}

export type OsPermission = 'granted' | 'denied' | 'undetermined';

/** What the phone shows when a scheduled notification fires. */
export interface LocalNotificationRequest {
  title: string;
  body: string;
  fireAt: Date;
  data: { scheduledId: Id; deepLink: string };
}

/**
 * Local notifications of the phone's OS (adapters/os/expoLocalNotifier.ts). Only local ones:
 * nothing here talks to a server (architecture rule 4).
 */
export interface LocalNotifier {
  permission(): Promise<OsPermission>;
  /** Shows the short explanation, then the OS prompt. True when the person allowed it. */
  askPermission(): Promise<boolean>;
  /** Schedules it and returns the OS id. */
  schedule(request: LocalNotificationRequest): Promise<string>;
  cancel(osId: string): Promise<void>;
}
