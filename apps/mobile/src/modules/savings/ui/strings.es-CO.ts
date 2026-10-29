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
  categories: {
    travel: 'Viaje',
    emergency: 'Fondo de emergencia',
    education: 'Educación',
    home: 'Hogar',
    vehicle: 'Vehículo',
    other: 'Otro',
  } satisfies Record<GoalCategory, string>,
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
} as const;

/** "Jun 2027" from '2027-06'. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return `${MONTHS_SHORT[m - 1]} ${year}`;
}
