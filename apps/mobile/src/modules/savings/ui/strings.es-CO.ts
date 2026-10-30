// User facing copy of the savings module (Spanish, Colombia).
import type { GoalError } from '../domain/goal';
import type { GoalCategory } from '../domain/goals';

export const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

export const savingsStrings = {
  // Milestone notices (design Notificaciones: "Viaje a Cartagena · Llegaste al 64 % de tu meta.").
  milestones: {
    reached: (percent: number) => `Llegaste al ${percent} % de tu meta.`,
    done: (target: string) => `Cumpliste tu meta de ${target}. ¡Bien hecho!`,
  },
  categories: {
    travel: 'Viaje',
    emergency: 'Fondo de emergencia',
    education: 'Educación',
    home: 'Hogar',
    vehicle: 'Vehículo',
    other: 'Otro',
  } satisfies Record<GoalCategory, string>,
  // Dashboard carousel (design Dashboard, "Planes de ahorro").
  carousel: {
    title: 'Planes de ahorro',
    seeAll: 'Ver todos',
    cardLabel: (name: string, percent: number) => `${name}, ${percent} % ahorrado. Ver en Metas`,
    // No goals yet: new copy, needs design review.
    emptyTitle: 'Crea tu primera meta',
    emptyMessage: 'Te decimos cuánto apartar al mes.',
  },
  metas: {
    title: 'Metas de ahorro',
    subtitle: 'Cada abono te acerca a lo que quieres.',
    back: 'Volver',
    active: (count: number) => `${count} ${count === 1 ? 'activa' : 'activas'}`,
    shareOfIncome: 'de tus ingresos va a tus metas',
    shareDetail: 'al mes de',
    // Without M10's income yet: the monthly amount alone (new copy, needs review).
    monthlyAlone: 'al mes van a tus metas',
    saved: 'Ahorrado',
    contributedThisMonth: 'Abonado este mes',
    done: 'Cumplidas',
    upcoming: 'Próximas metas',
    byDeadline: 'Por fecha límite',
    monthsLeft: (months: number) => `Faltan ${months} ${months === 1 ? 'mes' : 'meses'}`,
    of: (target: string) => `de ${target}`,
    suggested: 'Aporte sugerido',
    perMonth: '/mes',
    remaining: 'Te falta',
    edit: 'Editar meta',
    expand: (name: string) => `Ver detalle de ${name}`,
    progressLabel: (name: string) => `Progreso de ${name}`,
    doneTitle: 'Metas cumplidas',
    doneCount: (count: number) => `${count} ${count === 1 ? 'meta' : 'metas'}`,
    doneBanner: (amount: string) => `Has ahorrado ${amount} en metas cumplidas`,
    doneCheer: 'Sigue así, vas muy bien.',
    doneOn: (category: string, month: string) => `${category} · Cumplida en ${month}`,
    doneNoDate: (category: string) => `${category} · Cumplida`,
    fab: 'Nueva meta',
    fabLabel: 'Crear nueva meta de ahorro',
    emptyTitle: 'Aún no tienes metas',
    emptyMessage:
      'Ponle nombre a eso por lo que estás ahorrando y te decimos cuánto apartar al mes.',
    emptyAction: 'Crear meta',
    error: 'No pudimos cargar tus metas.',
  },
  form: {
    newTitle: 'Nueva meta',
    editTitle: 'Editar meta',
    back: 'Volver',
    name: 'Nombre de la meta',
    namePlaceholder: 'Ej: Viaje a Cartagena',
    category: 'Categoría',
    target: 'Monto objetivo',
    targetPlaceholder: '$0',
    deadline: 'Fecha límite',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    suggested: 'Aporte mensual sugerido',
    suggestedDetail: (months: number, target: string) =>
      `${months} ${months === 1 ? 'mes' : 'meses'} para llegar a ${target}`,
    suggestedEmpty: 'Escribe el monto objetivo para calcularlo.',
    save: 'Guardar meta',
    delete: 'Eliminar meta',
    confirmDelete: {
      title: (name: string) => `¿Eliminar ${name}?`,
      message: 'Se borran la meta y los aportes que registraste. Tu dinero no se mueve.',
      cancel: 'Cancelar',
      confirm: 'Eliminar',
    },
    saveFailed: 'No pudimos guardar. Intenta de nuevo.',
    notFound: 'Esta meta ya no existe.',
    errors: {
      name_required: 'Escribe un nombre.',
      name_too_long: 'Usa 40 caracteres o menos.',
      target_required: 'Escribe un monto mayor a $0.',
      target_too_large: 'Revisa el monto: es demasiado alto.',
      deadline_invalid: 'Elige un mes válido.',
      deadline_past: 'Elige este mes o uno futuro.',
    } satisfies Record<GoalError, string>,
  },
  // "Abonar a esta meta" in the open goal card (design Metas). The design's "Se descuenta de
  // Bancolombia · Ahorros" changes: Fynk never moves money, an aporte is a record (inventory 15).
  abonar: {
    title: 'Abonar a esta meta',
    amounts: 'Monto del abono',
    other: 'Otro monto',
    button: 'Abonar',
    buttonLabel: (amount: string, goal: string) => `Abonar ${amount} a ${goal}`,
    note: 'Es un registro de lo que apartaste. Fynk no mueve tu dinero.',
    invalid: 'Elige o escribe un monto mayor a $0.',
    failed: 'No pudimos registrar el abono. Intenta de nuevo.',
    // Toast after an aporte: new, needs design review (the design animates `.fb-toast`).
    done: (amount: string, goal: string) => `Abonaste ${amount} a ${goal}`,
    undo: 'Deshacer',
    undone: 'Abono deshecho',
  },
} as const;

/** "Jun 2027" from '2027-06'. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_SHORT[m - 1]} ${year}`;
}
