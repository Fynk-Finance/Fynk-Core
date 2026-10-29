// Copy of the analytics module (Spanish, Colombia).
export const analyticsStrings = {
  spending: {
    // New screen from the Dashboard "Gastos" pill (needs design review), styled as Estadisticas.
    title: 'Gastos por categoría',
    tabs: { categories: 'Categorías', trends: 'Tendencias' },
    periods: {
      thisMonth: 'Este mes',
      lastMonth: 'Mes anterior',
      last3Months: 'Últimos 3 meses',
      custom: 'Personalizado',
    },
    customFrom: 'Desde (AAAA-MM-DD)',
    customTo: 'Hasta (AAAA-MM-DD)',
    customInvalid: 'Escribe fechas válidas, la primera antes que la segunda.',
    total: 'Total',
    donutLabel: (total: string) => `Gastos por categoría, total ${total}`,
    categoryRow: (share: number, count: number) =>
      `${share} % · ${count} ${count === 1 ? 'movimiento' : 'movimientos'}`,
    dailyAverage: 'Promedio diario',
    empty: 'No hay gastos en este periodo.',
    emptyHint: 'Cuando tengas movimientos, aquí verás en qué se va tu dinero.',
  },
  trends: {
    months: (n: number) => `${n} meses`,
    all: 'Todos los gastos',
    chartLabel: (what: string, months: number) =>
      `Gasto mensual de ${what}, últimos ${months} meses`,
    change: (pct: number) => `${pct > 0 ? '+' : ''}${pct} % frente al mes anterior`,
    noChange: 'Sin mes anterior para comparar',
  },
  income: {
    title: 'Ingresos recurrentes',
    monthly: 'Mensual',
    biweekly: 'Quincenal',
    usualDay: (day: number) => `Suele llegar el día ${day}`,
    estimated: 'Estimado al mes',
    empty: 'Aún no vemos ingresos que se repitan.',
  },
  caps: {
    title: 'Topes',
    newCap: 'Nuevo tope',
    empty: 'Aún no tienes topes.',
    emptyHint:
      'Fija un tope semanal o mensual para una categoría y te avisamos al 80 % y al 100 %.',
    weekly: 'Semanal',
    monthly: 'Mensual',
    progress: (spent: string, cap: string) => `${spent} de ${cap}`,
    state: { ok: 'Vas bien', warning: 'Cerca del tope', reached: 'Tope alcanzado' },
    edit: 'Editar',
    delete: 'Eliminar',
  },
  capForm: {
    titleNew: 'Nuevo tope',
    titleEdit: 'Editar tope',
    category: 'Categoría',
    period: 'Periodo',
    amount: 'Monto del tope',
    amountHelper: 'Lo que quieres gastar como máximo en el periodo.',
    amountInvalid: 'Escribe un monto mayor a $0.',
    suggested: (amount: string) => `Sugerido: ${amount}, lo que gastaste el periodo anterior.`,
    treatsThreshold: 'Antojos son las compras por debajo de',
    treatsHelper: 'Por defecto $20.000.',
    save: 'Guardar tope',
    cancel: 'Cancelar',
  },
  alerts: {
    warningBody: (pct: number, period: 'week' | 'month', spent: string, cap: string) =>
      `Llevas el ${pct} % de tu tope ${period === 'week' ? 'semanal' : 'mensual'} (${spent} de ${cap}).`,
    reachedBody: (category: string, period: 'week' | 'month') =>
      `Llegaste a tu tope de ${category} ${period === 'week' ? 'esta semana' : 'este mes'}.`,
  },
  errors: {
    load: 'No pudimos calcular tus gastos. Intenta de nuevo.',
  },
} as const;
