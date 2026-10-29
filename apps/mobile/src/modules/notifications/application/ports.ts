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
  /** Runs `fn` in one vault transaction. */
  transaction<T>(fn: (store: InboxStore) => Promise<T>): Promise<T>;
}
