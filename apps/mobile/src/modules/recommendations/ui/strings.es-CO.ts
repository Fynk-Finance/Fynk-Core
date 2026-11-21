// Copy of the recommendations module (Spanish, Colombia). Recomendaciones.html, without the
// transport plan and without "Ver plan" (decided on 25 Oct 2026).
import type { StepCopy } from '../domain/steps';

export const recommendationsStrings = {
  title: 'Recomendaciones para ti',
  highlightBadge: 'Mayor impacto',
  perMonth: 'al mes',
  highlightLabel: (title: string, amount: string) =>
    `Recomendación más importante: ${title}, ${amount} al mes`,
  fronts: (n: number) => `Podrías ahorrar en ${n} ${n === 1 ? 'frente' : 'frentes'}`,
  donutLabel: (total: string, n: number) => `Ahorro posible: ${total} al mes en ${n} frentes`,
  filters: {
    label: 'Filtrar recomendaciones',
    all: 'Todas',
    expenses: 'Gastos',
    savings: 'Ahorro',
    subscriptions: 'Suscripciones',
  },
  nextSteps: 'Tus próximos pasos',
  suggestions: (n: number) => `${n} ${n === 1 ? 'sugerencia' : 'sugerencias'}`,
  tags: { expenses: 'Gastos', savings: 'Ahorro', subscriptions: 'Suscripciones' },
  actions: { cap: 'Fijar tope', payday: 'Programar', subscriptions: 'Revisar' },
  basedOn: (from: string, to: string) => `Basado en tus movimientos del ${from} al ${to}.`,
  writtenBy: 'Texto redactado con IA a partir de tus cifras.',
  aiOff: 'Las recomendaciones con IA están desactivadas. Ves sugerencias con nuestras plantillas.',
  offline: 'No pudimos actualizar las recomendaciones. Te mostramos las últimas que tenemos.',
  rateLimited: 'Ya actualizaste tus recomendaciones varias veces hoy. Te mostramos las últimas.',
  empty: 'Aún no tenemos sugerencias para ti.',
  emptyHint: 'Cuando tengas más movimientos, aquí verás en qué podrías ahorrar.',
  error: 'No pudimos calcular tus recomendaciones. Intenta de nuevo.',
  disclaimer:
    'Estas sugerencias se basan en tus movimientos y son informativas. No constituyen asesoría financiera ni recomendaciones de inversión.',
  guestName: 'Invitado',
} as const;

export const stepCopy: StepCopy = {
  titles: { subscriptions: 'Suscripciones', payday: 'Aporte automático' },
  templates: {
    categoryIncrease: (percent, category) =>
      `Este mes llevas un ${percent} % más en ${category.toLowerCase()} que el anterior. Fija un tope semanal.`,
    subscriptions: (count, total) =>
      `Tienes ${count} activas por ${total} al mes. Revisa cuáles usas.`,
    payday: (amount, goalName) => `Programa ${amount} para ${goalName} el día de tu salario.`,
  },
  saving: {
    perMonth: (amount) => `Ahorra ${amount} al mes`,
    upTo: (amount) => `Hasta ${amount} al mes`,
    monthsEarlier: (months) => `Meta ${months} ${months === 1 ? 'mes' : 'meses'} antes`,
    contribution: (amount) => `Aporte de ${amount}`,
  },
  highlight: {
    subscriptions: (count) =>
      `Cancela ${count} ${count === 1 ? 'suscripción que casi no usas' : 'suscripciones que casi no usas'}`,
    categoryIncrease: (category) => `Fija un tope para ${category}`,
  },
  summary: (total, fronts) =>
    `Podrías ahorrar hasta ${total} al mes en ${fronts} ${fronts === 1 ? 'frente' : 'frentes'}.`,
  summaryNothing: 'Tus gastos van estables. Sigue así.',
};
