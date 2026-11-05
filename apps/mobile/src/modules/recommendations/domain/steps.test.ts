import { formatCop } from '@shared/domain';
import type { Opportunity } from '@modules/analytics';

import { stepCopy } from '../ui/strings.es-CO';
import {
  buildSteps,
  canRegenerate,
  filterSteps,
  highlight,
  shortDate,
  snapshotKey,
  summaryText,
  type ModelTexts,
} from './steps';

// The opportunities of the design fixture, as M10 builds them.
const opportunities: Opportunity[] = [
  {
    factKey: 'subscriptions.low_use',
    kind: 'subscriptions',
    categoryId: 'subscriptions',
    monthlyMinor: 5_680_000,
    detail: { kind: 'subscriptions', count: 4, totalMonthlyMinor: 11_260_000, lowUseCount: 2 },
  },
  {
    factKey: 'category_increase.restaurants',
    kind: 'category_increase',
    categoryId: 'restaurants',
    monthlyMinor: 4_500_000,
    detail: {
      kind: 'category_increase',
      increasePercent: 30,
      last30dMinor: 19_500_000,
      prev30dMinor: 15_000_000,
      suggestedCapMinor: 15_000_000,
    },
  },
  {
    factKey: 'payday_contribution',
    kind: 'payday_contribution',
    categoryId: 'savings',
    monthlyMinor: 30_000_000,
    detail: {
      kind: 'payday_contribution',
      goalId: 'goal-cartagena',
      goalName: 'Viaje a Cartagena',
      monthsEarlier: 2,
      usualDay: 30,
    },
  },
];

const texts: ModelTexts = {
  summary: 'Vas bien este mes.',
  steps: [
    {
      factKey: 'category_increase.restaurants',
      title: 'Restaurantes',
      text: 'Este mes llevas un 30 % más que el anterior. Fija un tope semanal.',
    },
  ],
  fallback: false,
  modelId: 'amazon.nova-lite-v1:0',
  promptVersion: '2026-10-28.1',
  snapshotHash: 'abc',
  generatedAt: '2026-10-28T17:00:00Z',
};

describe('buildSteps (HU-025)', () => {
  it('keeps M10 order, numbers and actions, and takes only the text from the model', () => {
    const steps = buildSteps(opportunities, texts, stepCopy);
    expect(steps.map((s) => [s.number, s.title, s.tag, s.saving])).toEqual([
      [1, 'Suscripciones', 'subscriptions', 'Hasta $56.800 al mes'],
      [2, 'Restaurantes', 'expenses', 'Ahorra $45.000 al mes'],
      [3, 'Aporte automático', 'savings', 'Meta 2 meses antes'],
    ]);
    expect(steps[1]).toMatchObject({
      fromModel: true,
      text: 'Este mes llevas un 30 % más que el anterior. Fija un tope semanal.',
      action: { kind: 'cap', categoryId: 'restaurants', suggestedMinor: 15_000_000 },
    });
    // Without text from the model, a fixed template.
    expect(steps[0]).toMatchObject({
      fromModel: false,
      text: 'Tienes 4 activas por $112.600 al mes. Revisa cuáles usas.',
      action: { kind: 'subscriptions' },
    });
    expect(steps[2]).toMatchObject({
      text: 'Programa $300.000 para Viaje a Cartagena el día de tu salario.',
      action: { kind: 'payday', goalId: 'goal-cartagena', amountMinor: 30_000_000 },
    });
  });

  it('uses only templates when the backend answered fallback', () => {
    const steps = buildSteps(opportunities, { ...texts, fallback: true }, stepCopy);
    expect(steps.every((s) => !s.fromModel)).toBe(true);
    expect(steps[1]?.text).toBe(
      'Este mes llevas un 30 % más en restaurantes que el anterior. Fija un tope semanal.',
    );
  });

  it('never shows a transport plan or "Ver plan"', () => {
    const json = JSON.stringify(buildSteps(opportunities, null, stepCopy));
    expect(json).not.toMatch(/Ver plan|plan mensual|Transporte/);
  });

  it('filters by Gastos, Ahorro and Suscripciones', () => {
    const steps = buildSteps(opportunities, null, stepCopy);
    expect(filterSteps(steps, 'expenses').map((s) => s.factKey)).toEqual([
      'category_increase.restaurants',
    ]);
    expect(filterSteps(steps, 'savings')).toHaveLength(1);
    expect(filterSteps(steps, 'all')).toHaveLength(3);
  });
});

describe('highlight and summary', () => {
  it('puts the biggest saving in "Mayor impacto"', () => {
    expect(highlight(opportunities, stepCopy)).toEqual({
      title: 'Cancela 2 suscripciones que casi no usas',
      amountMinor: 5_680_000,
      action: { kind: 'subscriptions' },
    });
    expect(highlight([opportunities[2]!], stepCopy)).toBeNull();
  });

  it('uses the model summary, or a template from the same numbers', () => {
    expect(summaryText(texts, 10_180_000, 2, stepCopy)).toEqual({
      text: 'Vas bien este mes.',
      fromModel: true,
    });
    expect(summaryText(null, 10_180_000, 2, stepCopy).text).toBe(
      `Podrías ahorrar hasta ${formatCop(10_180_000)} al mes en 2 frentes.`,
    );
  });
});

describe('refresh and cache helpers', () => {
  it('regenerates at most once per hour', () => {
    const now = new Date('2026-10-28T18:00:00Z');
    expect(canRegenerate(null, now)).toBe(true);
    expect(canRegenerate('2026-10-28T17:30:00Z', now)).toBe(false);
    expect(canRegenerate('2026-10-28T17:00:00Z', now)).toBe(true);
  });

  it('keys the cache by the snapshot', () => {
    expect(snapshotKey('{"a":1}')).toBe(snapshotKey('{"a":1}'));
    expect(snapshotKey('{"a":1}')).not.toBe(snapshotKey('{"a":2}'));
    expect(shortDate('2025-11-01')).toBe('1 nov 2025');
  });
});
