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
    search: 'Buscar por nombre',
    noResults: 'No encontramos movimientos',
    noResultsMessage: 'Prueba con otra palabra o cambia los filtros.',
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
  filters: {
    open: 'Filtros',
    activeCount: (n: number) => (n === 1 ? 'Filtros, 1 activo' : `Filtros, ${n} activos`),
    title: 'Filtros',
    close: 'Cerrar filtros',
    kind: 'Tipo',
    kinds: { all: 'Todos', income: 'Ingresos', expense: 'Gastos' },
    dates: 'Fecha',
    presets: {
      any: 'Todas',
      this_month: 'Este mes',
      last_month: 'Mes anterior',
      last_3_months: 'Últimos 3 meses',
      custom: 'Personalizado',
    },
    from: 'Desde',
    to: 'Hasta',
    dayPlaceholder: 'dd/mm/aaaa',
    amount: 'Monto',
    min: 'Mínimo',
    max: 'Máximo',
    accounts: 'Cuentas',
    categories: 'Categorías',
    clear: 'Limpiar',
    apply: 'Aplicar',
    errors: {
      day: 'Escribe la fecha como dd/mm/aaaa.',
      dates: 'La fecha final es anterior a la inicial.',
      amounts: 'El monto mínimo es mayor que el máximo.',
      amount: 'Escribe el monto en pesos, sin decimales.',
    },
  },
  account: {
    title: 'Movimientos',
    count: (n: number) => (n === 1 ? '1 movimiento' : `${n} movimientos`),
    empty: 'Esta cuenta aún no tiene movimientos.',
  },
} as const;
