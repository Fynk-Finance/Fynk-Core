// Rows of "Ajustes de notificaciones" (design CfgNotificaciones, M12 step 3). Each row turns one
// or more notification kinds on or off. The design's "Gastos grandes" and "Saldo bajo" are not
// kinds of the shared contract yet, so they are left out until the team adds them (session log).
// Rows the design lacks (price increases, sync, caps, new devices) follow the M12 prompt.
import type { NotificationKind } from '@shared/ports';
import type { IconName } from '@shared/ui';

export type SettingsSectionKey = 'payments' | 'money' | 'goals' | 'security';

export type SettingsRowKey =
  | 'payments'
  | 'renewals'
  | 'priceUp'
  | 'income'
  | 'sync'
  | 'caps'
  | 'goals'
  | 'recommendations'
  | 'devices';

export interface SettingsRow {
  key: SettingsRowKey;
  icon: IconName;
  kinds: readonly NotificationKind[];
  /** New devices cannot be turned off: approving a phone is a security check. */
  locked?: boolean;
}

export const SETTINGS_SECTIONS: readonly { key: SettingsSectionKey; rows: SettingsRow[] }[] = [
  {
    key: 'payments',
    rows: [
      { key: 'payments', icon: 'calendar', kinds: ['payment_due'] },
      { key: 'renewals', icon: 'card', kinds: ['subscription_renewal'] },
      { key: 'priceUp', icon: 'chartLine', kinds: ['subscription_price_up'] },
    ],
  },
  {
    key: 'money',
    rows: [
      { key: 'income', icon: 'arrowUpRight', kinds: ['income_received'] },
      { key: 'sync', icon: 'sync', kinds: ['sync_result'] },
      { key: 'caps', icon: 'warning', kinds: ['cap_warning', 'cap_reached'] },
    ],
  },
  {
    key: 'goals',
    rows: [
      { key: 'goals', icon: 'goal', kinds: ['goal_milestone'] },
      { key: 'recommendations', icon: 'tabRecommendations', kinds: ['recommendation'] },
    ],
  },
  {
    key: 'security',
    rows: [{ key: 'devices', icon: 'shield', kinds: ['device_approval'], locked: true }],
  },
];

/** Days before a payment for its reminder: "El mismo día", "1 día antes", "2 días antes". */
export const PAYMENT_LEAD_DAYS = [0, 1, 2] as const;
export type PaymentLeadDays = (typeof PAYMENT_LEAD_DAYS)[number];
/** M9 prompt: 2 days before by default. */
export const DEFAULT_PAYMENT_LEAD_DAYS: PaymentLeadDays = 2;

export function parseLeadDays(value: string | null): PaymentLeadDays {
  const n = Number(value);
  return (PAYMENT_LEAD_DAYS as readonly number[]).includes(n) && value !== null
    ? (n as PaymentLeadDays)
    : DEFAULT_PAYMENT_LEAD_DAYS;
}

/** A row is on when all its kinds are on. */
export function rowEnabled(
  row: SettingsRow,
  enabled: (kind: NotificationKind) => boolean,
): boolean {
  return row.locked === true || row.kinds.every(enabled);
}
