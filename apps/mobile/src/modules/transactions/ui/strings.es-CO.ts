// User facing copy of the transactions module (Spanish, Colombia).
import type { AccountKind } from '@shared/domain/types';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;
const MONTHS = [
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
] as const;

/** "22 sep" from '2026-09-22'. */
export function shortDate(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[(month ?? 1) - 1]}`;
}

export const transactionsStrings = {
  weekdays: WEEKDAYS,
  months: MONTHS,
  kinds: {
    savings: 'Cuenta de ahorros',
    checking: 'Cuenta corriente',
    wallet: 'Billetera digital',
    credit_card: 'Tarjeta de crédito',
    cdt: 'CDT',
    cash: 'Efectivo',
  } satisfies Record<AccountKind, string>,
  list: {
    title: 'Movimientos',
    back: 'Volver al dashboard',
    today: 'Hoy',
    yesterday: 'Ayer',
    showing: (shown: number, total: number) => `Mostrando ${shown} de ${total}`,
    loadMore: 'Cargar 20 más',
    empty: 'Aún no tienes movimientos',
    emptyMessage: 'Cuando conectes una cuenta o registres un gasto, aparecerán aquí.',
    error: 'No pudimos cargar tus movimientos.',
    rowLabel: (title: string, amount: string) => `Ver detalle de ${title}, ${amount}`,
  },
  preview: {
    title: 'Movimientos',
    seeAll: 'Ver todo',
    empty: 'Aún no tienes movimientos.',
  },
  account: {
    title: 'Movimientos',
    count: (n: number) => (n === 1 ? '1 movimiento' : `${n} movimientos`),
    empty: 'Esta cuenta aún no tiene movimientos.',
  },
} as const;
