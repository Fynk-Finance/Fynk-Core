// Payment and renewal reminders of recurring items (SCRUM-57, HU-041) through M12's
// NotificationsPort: local notifications only, never push. Each item keeps one pending reminder
// for its next charge, replaced on every change, after each sync and when the vault opens.
// M12 drops it when the person turns the kind off in Ajustes de notificaciones.
import { formatCop } from '@shared/domain/money';
import type { Clock, Id, MoneyMinor } from '@shared/domain/types';
import type { NotificationsPort } from '@shared/ports';

import type { StoredRecurringItem } from '../domain/item';
import { reminderPlan, type LeadDays, type ReminderPlan } from '../domain/reminder';
import { recurringStrings } from '../ui/strings.es-CO';

const t = recurringStrings.reminders;

export interface ReminderDeps {
  notifications: Pick<NotificationsPort, 'schedule' | 'cancel'>;
  /** Days before a charge, from Ajustes de notificaciones (M12). */
  leadDays: () => Promise<LeadDays>;
  clock: Clock;
}

export interface ReminderScheduler {
  /** Schedules the next reminder of the item, or cancels it when it should not have one. */
  plan(item: StoredRecurringItem): Promise<void>;
  /** For a deleted item. */
  cancel(id: Id): Promise<void>;
}

/** One pending reminder per item: scheduling again with this id replaces it. */
export const reminderId = (itemId: Id) => `recurring.reminder.${itemId}`;

/** Opens the item in Billetera (src/app/linking.ts). */
export const reminderLink = (itemId: Id) => `fynk://billetera/recurrentes/${itemId}`;

/** "Vence en 2 días: $186.000." or "Se renueva el 28 sep por $38.900." */
export function reminderBody(
  plan: Pick<ReminderPlan, 'kind' | 'chargeDate' | 'leadDays'>,
  amountMinor: MoneyMinor,
): string {
  const amount = formatCop(amountMinor);
  if (plan.kind === 'payment_due') return t.paymentDue(plan.leadDays, amount);
  const [, month, day] = plan.chargeDate.split('-').map(Number) as [number, number, number];
  return t.renewal(plan.leadDays, `${day} ${t.months[month - 1]}`, amount);
}

export function createReminderScheduler(deps: ReminderDeps): ReminderScheduler {
  return {
    async plan(item) {
      const plan = reminderPlan(item, deps.clock.now(), await deps.leadDays());
      if (!plan) {
        await deps.notifications.cancel(reminderId(item.id));
        return;
      }
      await deps.notifications.schedule({
        id: reminderId(item.id),
        kind: plan.kind,
        title: item.name,
        body: reminderBody(plan, item.amountMinor),
        deepLink: reminderLink(item.id),
        // The same charge never reaches the inbox twice, even if it is scheduled again.
        dedupeKey: `${reminderId(item.id)}.${plan.chargeDate}`,
        fireAt: plan.fireAt,
      });
    },

    async cancel(id) {
      await deps.notifications.cancel(reminderId(id));
    },
  };
}
