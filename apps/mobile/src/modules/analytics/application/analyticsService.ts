// Use cases of the analytics module: read the movements and summaries of other modules through
// ports, run the pure domain functions, and keep the caps in the vault.
import {
  categoryLabel,
  formatCop,
  type AggregateSnapshot,
  type CategoryId,
  type Clock,
  type Id,
  type IsoDate,
  type MoneyMinor,
  type Transaction,
} from '@shared/domain';
import type { MarkDirty, NotificationsPort } from '@shared/ports';

import {
  capAlertsDue,
  capStatus,
  DEFAULT_TREATS_THRESHOLD_MINOR,
  suggestedCapFor,
} from '../domain/caps';
import { addMonths, bogotaDate, firstDayOfMonth, monthOf, type MonthKey } from '../domain/dates';
import { recurringIncome } from '../domain/recurringIncome';
import { buildSnapshot, opportunitiesFrom, type AnalyticsInputs } from '../domain/snapshot';
import { monthSummary, spendByCategory, trend } from '../domain/spending';
import type {
  CapPeriod,
  CapStatus,
  MonthSummary,
  Opportunity,
  RecurringIncomeSource,
  SpendByCategory,
  SpendingCap,
  Trend,
} from '../domain/types';
import { analyticsStrings } from '../ui/strings.es-CO';
import type { AnalyticsSources, CapsStore } from './ports';

export const CAPS_BACKUP_COLLECTION = 'analytics.caps';
export const CAPS_DEEP_LINK = 'fynk://analisis/topes';

export interface AnalyticsServiceDeps {
  sources: AnalyticsSources;
  caps: CapsStore;
  notifications: NotificationsPort;
  clock: Clock;
  markDirty: MarkDirty;
  newId: () => Id;
}

export interface CapInput {
  id?: Id;
  categoryId: CategoryId;
  period: CapPeriod;
  capMinor: MoneyMinor;
}

export class InvalidCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCapError';
  }
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;

export function createAnalyticsService(deps: AnalyticsServiceDeps) {
  const today = (): IsoDate => bogotaDate(deps.clock.now());

  /** 12 calendar months ending this month: enough for every function of the domain. */
  const loadTransactions = async (): Promise<Transaction[]> => {
    const t = today();
    return deps.sources.listTransactions(firstDayOfMonth(addMonths(monthOf(t), -12)), t);
  };

  const loadInputs = async (): Promise<AnalyticsInputs> => {
    const [transactions, subscriptions, fixedExpensesMonthlyMinor, goals, caps, payday] =
      await Promise.all([
        loadTransactions(),
        deps.sources.getSubscriptionSummary(),
        deps.sources.getFixedExpensesMonthly(),
        deps.sources.getGoalSummaries(),
        deps.caps.listActive(),
        deps.sources.getPaydayContribution(),
      ]);
    return { transactions, subscriptions, fixedExpensesMonthlyMinor, goals, caps, payday };
  };

  const validate = (input: CapInput) => {
    if (!Number.isSafeInteger(input.capMinor) || input.capMinor <= 0) {
      throw new InvalidCapError('The cap must be a positive amount');
    }
    if (input.period !== 'week' && input.period !== 'month') {
      throw new InvalidCapError('The period must be week or month');
    }
  };

  const service = {
    today,

    async getMonthSummary(month: MonthKey = monthOf(today())): Promise<MonthSummary> {
      return monthSummary(await loadTransactions(), month);
    },

    async getSpendByCategory(from: IsoDate, to: IsoDate): Promise<SpendByCategory> {
      return spendByCategory(await deps.sources.listTransactions(from, to), from, to);
    },

    async getTrend(categoryId: CategoryId | 'all', months: number): Promise<Trend> {
      return trend(await loadTransactions(), categoryId, months, monthOf(today()));
    },

    async getRecurringIncome(): Promise<RecurringIncomeSource[]> {
      return recurringIncome(await loadTransactions(), today());
    },

    async getOpportunities(): Promise<Opportunity[]> {
      return opportunitiesFrom(await loadInputs(), today());
    },

    /** Snapshot and opportunities from the same inputs, so the screen and the model agree. */
    async getReport(): Promise<{ snapshot: AggregateSnapshot; opportunities: Opportunity[] }> {
      const inputs = await loadInputs();
      const t = today();
      return { snapshot: buildSnapshot(inputs, t), opportunities: opportunitiesFrom(inputs, t) };
    },

    async buildSnapshot(): Promise<AggregateSnapshot> {
      return buildSnapshot(await loadInputs(), today());
    },

    async listCapStatuses(): Promise<CapStatus[]> {
      const [caps, txs] = await Promise.all([deps.caps.listActive(), loadTransactions()]);
      const t = today();
      return caps.map((cap) => capStatus(cap, txs, t));
    },

    async getCap(id: Id): Promise<SpendingCap | null> {
      const record = await deps.caps.get(id);
      if (!record || record.deletedAt) return null;
      const { deletedAt: _d, version: _v, ...cap } = record;
      return cap;
    },

    async saveCap(input: CapInput): Promise<SpendingCap> {
      validate(input);
      const existing = input.id ? await deps.caps.get(input.id) : null;
      const cap: SpendingCap = {
        id: existing?.id ?? deps.newId(),
        categoryId: input.categoryId,
        period: input.period,
        capMinor: input.capMinor,
        createdAt: existing?.createdAt ?? deps.clock.now().toISOString(),
      };
      await deps.caps.save(cap);
      deps.markDirty(CAPS_BACKUP_COLLECTION, cap.id);
      await service.evaluateCaps();
      return cap;
    },

    async deleteCap(id: Id): Promise<void> {
      await deps.caps.softDelete(id, deps.clock.now().toISOString());
      deps.markDirty(CAPS_BACKUP_COLLECTION, id);
    },

    async suggestedCap(categoryId: CategoryId, period: CapPeriod): Promise<MoneyMinor> {
      return suggestedCapFor(await loadTransactions(), categoryId, period, today());
    },

    async getTreatsThreshold(): Promise<MoneyMinor> {
      return (
        (await deps.caps.getSettings())?.treatsThresholdMinor ?? DEFAULT_TREATS_THRESHOLD_MINOR
      );
    },

    async setTreatsThreshold(minor: MoneyMinor): Promise<void> {
      if (!Number.isSafeInteger(minor) || minor <= 0) {
        throw new InvalidCapError('The threshold must be a positive amount');
      }
      await deps.caps.setTreatsThreshold(minor);
      deps.markDirty(CAPS_BACKUP_COLLECTION, 'settings');
    },

    /**
     * Sends the cap alerts that are due (once per cap, period and level). Runs on sync.completed,
     * transactions.changed and vault.unlocked, that is, when the app opens or refreshes.
     */
    async evaluateCaps(): Promise<number> {
      const [statuses, sent] = await Promise.all([
        service.listCapStatuses(),
        deps.caps.sentAlertKeys(),
      ]);
      const { alerts, record } = capAlertsDue(statuses, sent);
      const s = analyticsStrings.alerts;
      let shown = 0;
      for (const alert of alerts) {
        const { cap, spentMinor, percent, periodKey } = alert.status;
        const kind = alert.level === 'reached' ? 'cap_reached' : 'cap_warning';
        if (!(await deps.notifications.isEnabled(kind))) continue;
        const category = categoryLabel(cap.categoryId);
        await deps.notifications.notify({
          kind,
          title: category,
          body:
            alert.level === 'reached'
              ? s.reachedBody(category, cap.period)
              : s.warningBody(percent, cap.period, formatCop(spentMinor), formatCop(cap.capMinor)),
          deepLink: CAPS_DEEP_LINK,
          dedupeKey: `cap:${cap.id}:${periodKey}:${alert.level}`,
        });
        shown += 1;
      }
      await deps.caps.recordAlerts(record, deps.clock.now().toISOString());
      return shown;
    },
  };
  return service;
}
