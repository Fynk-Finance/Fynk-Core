// Copy of the analytics module (Spanish, Colombia).
export const analyticsStrings = {
  spending: {
    total: 'Total',
    empty: 'No hay gastos en este periodo.',
    emptyHint: 'Cuando tengas movimientos, aquí verás en qué se va tu dinero.',
  },
  // Estadísticas (design screen 14).
  statistics: {
    title: 'Estadísticas',
    back: 'Volver',
    spentIn: {
      '3d': 'Gastaste en los últimos 3 días',
      week: 'Gastaste en los últimos 7 días',
      month: 'Gastaste en los últimos 30 días',
      year: 'Gastaste en el último año',
    },
    lastDays: {
      '3d': 'Últimos 3 días',
      week: 'Últimos 7 días',
      month: 'Últimos 30 días',
      year: 'Último año',
    },
    previousOf: {
      '3d': 'los 3 días anteriores',
      week: 'la semana anterior',
      month: 'el mes anterior',
      year: 'el año anterior',
    },
    periods: { '3d': '3 días', week: 'Semana', month: 'Mes', year: 'Año' },
    periodGroup: 'Periodo de la gráfica',
    income: 'Ingresos',
    incomeLabel: (amount: string) => `Ingresos: ${amount}`,
    thisPeriod: 'Este periodo',
    previousPeriod: 'Periodo anterior',
    balance: (signed: string) => `Balance ${signed}`,
    today: 'Hoy',
    chartLabel: (what: string, spent: string, income: string, change: string) =>
      `Gasto acumulado en ${what}: ${spent}. Ingresos: ${income}. ${change}`,
    changeVs: (pct: number, previous: string) =>
      pct === 0
        ? `Igual que ${previous}`
        : `${Math.abs(pct)} % ${pct < 0 ? 'menos' : 'más'} que ${previous}`,
    byCategory: 'Gastos por categoría',
    yourStats: 'Tus estadísticas',
    dailyAverage: 'Promedio diario',
    highest: 'Gasto más alto',
    highestDetail: (label: string, date: string) => `${label} · ${date}`,
    movements: 'Movimientos',
    movementsDelta: (delta: number, previous: string) =>
      delta === 0
        ? `Los mismos que ${previous}`
        : `${Math.abs(delta)} ${delta > 0 ? 'más' : 'menos'} que ${previous}`,
    saved: 'Ahorraste',
    spentMore: 'Gastaste de más',
    versus: (previous: string) => `Frente a ${previous}`,
    byWeekday: 'Por día de la semana',
    average: 'Promedio',
    weekdaysShort: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    weekdaysPlural: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'],
    weekdayChart: (bars: string) => `Gasto promedio por día: ${bars}`,
    times: (percent: number) =>
      percent >= 190 && percent <= 210
        ? 'el doble'
        : percent >= 290 && percent <= 310
          ? 'el triple'
          : `un ${percent - 100} % más`,
    weekdayPeak: (day: string, times: string, againstWeekdays: boolean) =>
      [
        'Los ',
        day,
        ` gastas en promedio ${times} que ${againstWeekdays ? 'entre semana' : 'el resto de la semana'}.`,
      ] as const,
    weekdayEven: 'Gastas parecido todos los días de la semana.',
    topPlaces: 'Dónde más gastas',
    placeCount: (count: number, categoryId: string) => {
      const [one, many] =
        categoryId === 'transport'
          ? ['recarga', 'recargas']
          : ['restaurants', 'cinema', 'treats'].includes(categoryId)
            ? ['visita', 'visitas']
            : ['compra', 'compras'];
      return `${count} ${count === 1 ? one : many}`;
    },
    caps: 'Topes de gasto',
    capsHint: 'Fija cuánto quieres gastar por categoría',
    trends: 'Tendencias',
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    empty: 'Aún no hay gastos en este periodo.',
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
    categoryPlaceholder: 'Elige una categoría',
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
