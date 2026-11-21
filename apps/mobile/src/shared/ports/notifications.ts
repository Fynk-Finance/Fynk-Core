// Notifications port (00-shared-contracts.md, section 3.4). Implemented by M12.
// Tests use createInMemoryNotifications() from @shared/testing.
import type { IsoDateTime } from '../domain/types';

export type NotificationKind =
  | 'payment_due'
  | 'income_received'
  | 'recommendation'
  | 'goal_milestone'
  | 'sync_result'
  | 'subscription_renewal'
  | 'subscription_price_up'
  | 'cap_warning'
  | 'cap_reached'
  | 'device_approval';

export interface NotifyInput {
  kind: NotificationKind;
  title: string; // 'Servicios públicos'
  body: string; // 'Vence en 2 días: $186.000.'
  deepLink: string; // 'fynk://billetera/recurrentes/<id>'
  dedupeKey: string; // same key never shows twice
}

export interface ScheduleInput extends NotifyInput {
  id: string;
  fireAt: IsoDateTime;
}

export interface NotificationsPort {
  /** Inbox entry now. */
  notify(n: NotifyInput): Promise<void>;
  /** Local OS notification, plus an inbox entry when it fires. */
  schedule(n: ScheduleInput): Promise<void>;
  cancel(id: string): Promise<void>;
  isEnabled(kind: NotificationKind): Promise<boolean>;
}
