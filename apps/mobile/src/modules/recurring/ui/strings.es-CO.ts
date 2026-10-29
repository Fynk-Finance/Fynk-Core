// User facing copy of the recurring module (Spanish, Colombia).
import type { RecurringError } from '../domain/item';

export const recurringStrings = {
  form: {
    newTitle: 'Nuevo gasto recurrente',
    editTitle: 'Editar gasto recurrente',
    back: 'Volver a Billetera',
    name: 'Nombre',
    namePlaceholder: 'Arriendo, gimnasio, streaming…',
    kind: 'Tipo',
    kinds: { fixed: 'Gasto fijo', subscription: 'Suscripción' },
    category: 'Categoría',
    amount: 'Monto',
    amountPlaceholder: '$0',
    periodicity: 'Cada cuánto',
    periodicities: { monthly: 'Mensual', weekly: 'Semanal', daily: 'Diario' },
    day: 'Día de cobro',
    dayHelper: 'Del 1 al 31. Si el mes es más corto, el último día.',
    weekday: 'Día de la semana',
    weekdays: 'Días',
    reminder: 'Recordatorio',
    reminderOn: 'Te avisaremos antes de cada pago',
    reminderOff: 'Desactivado',
    save: 'Guardar',
    delete: 'Eliminar gasto',
    confirmDelete: {
      title: (name: string) => `¿Eliminar ${name}?`,
      message: 'Dejará de contar en tus gastos fijos y no te recordaremos su pago.',
      cancel: 'Cancelar',
      confirm: 'Eliminar',
    },
    saveFailed: 'No pudimos guardar. Intenta de nuevo.',
    notFound: 'Este gasto ya no existe.',
    errors: {
      name_required: 'Escribe un nombre.',
      name_too_long: 'Usa 40 caracteres o menos.',
      amount_required: 'Escribe un monto mayor a $0.',
      amount_too_large: 'Revisa el monto: es demasiado alto.',
      day_invalid: 'Escribe un día del 1 al 31.',
      weekdays_required: 'Elige al menos un día.',
      date_invalid: 'Elige una fecha válida.',
    } satisfies Record<RecurringError, string>,
  },
  // Lun, Mar… in the order of the weekday mask bits (Sunday first).
  weekdayShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
} as const;
