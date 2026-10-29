// How each kind of notification looks in the inbox (design: Notificaciones).
// Lime tile for payments and recommendations, light blue for income, goals, sync and
// subscriptions. Caps and new devices are not in the design: they use the light blue tile with
// the warning and shield icons (new, needs design review).
import type { NotificationKind } from '@shared/ports';
import type { IconName, IconTileTone } from '@shared/ui';

export interface KindStyle {
  icon: IconName;
  tone: Extract<IconTileTone, 'accent' | 'soft'>;
}

export const KIND_STYLES: Record<NotificationKind, KindStyle> = {
  payment_due: { icon: 'bolt', tone: 'accent' },
  recommendation: { icon: 'tabRecommendations', tone: 'accent' },
  income_received: { icon: 'arrowDown', tone: 'soft' },
  goal_milestone: { icon: 'goal', tone: 'soft' },
  sync_result: { icon: 'sync', tone: 'soft' },
  subscription_renewal: { icon: 'card', tone: 'soft' },
  subscription_price_up: { icon: 'card', tone: 'soft' },
  cap_warning: { icon: 'warning', tone: 'soft' },
  cap_reached: { icon: 'warning', tone: 'soft' },
  device_approval: { icon: 'shield', tone: 'soft' },
};

/** Every kind, in the order of the settings screen. */
export const NOTIFICATION_KINDS = Object.keys(KIND_STYLES) as NotificationKind[];

/** Kinds the person cannot turn off: approving a new phone is a security check. */
export const ALWAYS_ON: ReadonlySet<NotificationKind> = new Set(['device_approval']);
