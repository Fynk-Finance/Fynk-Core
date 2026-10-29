// What the Recomendaciones screen shows, built from M10's opportunities (order, numbers and
// actions) and, when there is one, the model's text matched by factKey. Pure: no React, no I/O.
// Rule 5 of CLAUDE.md: every number comes from the opportunity, never from the model.
import {
  categoryLabel,
  formatCop,
  type CategoryId,
  type Id,
  type IsoDate,
  type MoneyMinor,
} from '@shared/domain';
import type { Opportunity } from '@modules/analytics';

/** The texts of POST /recommendations. */
export interface ModelTexts {
  summary: string;
  steps: { factKey: string; title: string; text: string }[];
  fallback: boolean;
  modelId: string;
  promptVersion: string;
  snapshotHash: string;
  generatedAt: string;
}

export type StepTag = 'expenses' | 'savings' | 'subscriptions';
export type StepFilter = 'all' | StepTag;

export type StepAction =
  | { kind: 'cap'; categoryId: CategoryId; suggestedMinor: MoneyMinor }
  | { kind: 'payday'; goalId: Id; amountMinor: MoneyMinor }
  | { kind: 'subscriptions' };

export type StepIcon =
  | 'food'
  | 'cart'
  | 'bus'
  | 'coffee'
  | 'monitor'
  | 'gym'
  | 'phone'
  | 'bolt'
  | 'home'
  | 'tv'
  | 'piggy'
  | 'chartLine';

export interface ViewStep {
  number: number;
  factKey: string;
  icon: StepIcon;
  title: string;
  tag: StepTag;
  text: string;
  /** True when the text is the model's, false for the fixed template. */
  fromModel: boolean;
  saving: string;
  action: StepAction;
}

/** Fixed sentences of the screen, in Spanish; supplied by ui/strings.es-CO.ts. */
export interface StepCopy {
  titles: { subscriptions: string; payday: string };
  templates: {
    categoryIncrease: (percent: number, category: string) => string;
    subscriptions: (count: number, total: string) => string;
    payday: (amount: string, goalName: string) => string;
  };
  saving: {
    perMonth: (amount: string) => string;
    upTo: (amount: string) => string;
    monthsEarlier: (months: number) => string;
    contribution: (amount: string) => string;
  };
  highlight: {
    subscriptions: (count: number) => string;
    categoryIncrease: (category: string) => string;
  };
  summary: (total: string, fronts: number) => string;
  summaryNothing: string;
}

const CATEGORY_ICONS: Partial<Record<CategoryId, StepIcon>> = {
  restaurants: 'food',
  groceries: 'cart',
  transport: 'bus',
  treats: 'coffee',
  cinema: 'monitor',
  gym: 'gym',
  telecom: 'phone',
  utilities: 'bolt',
  rent: 'home',
  subscriptions: 'tv',
};

export function tagOf(o: Opportunity): StepTag {
  if (o.kind === 'category_increase') return 'expenses';
  if (o.kind === 'payday_contribution') return 'savings';
  return 'subscriptions';
}

function templateStep(o: Opportunity, copy: StepCopy): { title: string; text: string } {
  const d = o.detail;
  switch (d.kind) {
    case 'category_increase': {
      const category = categoryLabel(o.categoryId ?? 'other');
      return {
        title: category,
        text: copy.templates.categoryIncrease(d.increasePercent, category),
      };
    }
    case 'subscriptions':
      return {
        title: copy.titles.subscriptions,
        text: copy.templates.subscriptions(d.count, formatCop(d.totalMonthlyMinor)),
      };
    case 'payday_contribution':
      return {
        title: copy.titles.payday,
        text: copy.templates.payday(formatCop(o.monthlyMinor), d.goalName),
      };
  }
}

function savingLine(o: Opportunity, copy: StepCopy): string {
  const d = o.detail;
  switch (d.kind) {
    case 'category_increase':
      return copy.saving.perMonth(formatCop(o.monthlyMinor));
    case 'subscriptions':
      return copy.saving.upTo(formatCop(o.monthlyMinor));
    case 'payday_contribution':
      return d.monthsEarlier > 0
        ? copy.saving.monthsEarlier(d.monthsEarlier)
        : copy.saving.contribution(formatCop(o.monthlyMinor));
  }
}

function actionOf(o: Opportunity): StepAction {
  const d = o.detail;
  switch (d.kind) {
    case 'category_increase':
      return {
        kind: 'cap',
        categoryId: o.categoryId ?? 'other',
        suggestedMinor: d.suggestedCapMinor,
      };
    case 'payday_contribution':
      return { kind: 'payday', goalId: d.goalId, amountMinor: o.monthlyMinor };
    case 'subscriptions':
      return { kind: 'subscriptions' };
  }
}

/** One step per opportunity, in M10's order. The model only replaces the title and the text. */
export function buildSteps(
  opportunities: readonly Opportunity[],
  texts: ModelTexts | null,
  copy: StepCopy,
): ViewStep[] {
  const byKey = new Map(
    texts && !texts.fallback ? texts.steps.map((s) => [s.factKey, s] as const) : [],
  );
  return opportunities.map((o, i) => {
    const model = byKey.get(o.factKey);
    const template = templateStep(o, copy);
    return {
      number: i + 1,
      factKey: o.factKey,
      icon:
        o.kind === 'payday_contribution'
          ? 'piggy'
          : (CATEGORY_ICONS[o.categoryId ?? 'other'] ?? 'chartLine'),
      title: model?.title.trim() || template.title,
      tag: tagOf(o),
      text: model?.text.trim() || template.text,
      fromModel: Boolean(model?.text.trim()),
      saving: savingLine(o, copy),
      action: actionOf(o),
    };
  });
}

export function filterSteps(steps: readonly ViewStep[], filter: StepFilter): ViewStep[] {
  return filter === 'all' ? [...steps] : steps.filter((s) => s.tag === filter);
}

/** The "Mayor impacto" card: the saving opportunity with the highest monthly amount. */
export function highlight(
  opportunities: readonly Opportunity[],
  copy: StepCopy,
): { title: string; amountMinor: MoneyMinor; action: StepAction } | null {
  const top = opportunities.find((o) => o.kind !== 'payday_contribution');
  if (!top) return null;
  const d = top.detail;
  const title =
    d.kind === 'subscriptions'
      ? copy.highlight.subscriptions(d.lowUseCount)
      : copy.highlight.categoryIncrease(categoryLabel(top.categoryId ?? 'other'));
  return { title, amountMinor: top.monthlyMinor, action: actionOf(top) };
}

/** The summary paragraph: the model's, or a fixed sentence from the same numbers. */
export function summaryText(
  texts: ModelTexts | null,
  savingTotalMinor: MoneyMinor,
  fronts: number,
  copy: StepCopy,
): { text: string; fromModel: boolean } {
  if (texts && !texts.fallback && texts.summary.trim()) {
    return { text: texts.summary.trim(), fromModel: true };
  }
  if (fronts === 0) return { text: copy.summaryNothing, fromModel: false };
  return { text: copy.summary(formatCop(savingTotalMinor), fronts), fromModel: false };
}

/** Pull to refresh asks the model again at most once per hour. */
export const REGENERATE_AFTER_MS = 60 * 60 * 1000;

export function canRegenerate(lastGeneratedAt: string | null, now: Date): boolean {
  if (!lastGeneratedAt) return true;
  const last = Date.parse(lastGeneratedAt);
  return Number.isNaN(last) || now.getTime() - last >= REGENERATE_AFTER_MS;
}

/** FNV-1a 32-bit of a string, hex: the cache key of a snapshot on this phone. */
export function snapshotKey(json: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** "28 oct 2026" in Spanish, for the traceability line. */
export function shortDate(date: IsoDate): string {
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}
