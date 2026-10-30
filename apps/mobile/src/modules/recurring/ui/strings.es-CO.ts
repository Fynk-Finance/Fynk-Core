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
    usage: '¿Cuánto la usas?',
    usageHelper: 'Las que casi no usas suman a tu oportunidad de ahorro.',
    usages: { high: 'Mucho', some: 'A veces', low: 'Casi nunca' },
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
  billetera: {
    title: 'Billetera',
    subtitle: 'Gastos fijos de este mes',
    // M1 exports no first name yet; M0's placeholder shows the same word.
    guest: 'Invitado',
    recurring: 'Gastos recurrentes',
    add: '+ Agregar',
    emptyTitle: 'Aún no tienes gastos recurrentes',
    emptyMessage:
      'Agrega tu arriendo, servicios o suscripciones y te avisaremos antes de cada pago.',
    emptyAction: 'Agregar gasto',
    error: 'No pudimos cargar tus gastos recurrentes.',
    cardLabel: (name: string, amount: string, schedule: string, state: string) =>
      [name, amount, schedule, state].filter(Boolean).join(', '),
    // The design's title for the subscriptions section.
    subscriptions: 'Otros gastos',
    subscriptionsMeta: (count: number, amount: string) =>
      `${count} ${count === 1 ? 'activa' : 'activas'} · ${amount}/mes`,
    lowUse: 'Poco uso',
    renews: (date: string) => `Renueva ${date}`,
    savings: {
      overline: 'Oportunidad de ahorro',
      before: 'Ahorra ',
      after: ' al mes',
      subtitle: (count: number) =>
        count === 1 ? '1 suscripción que casi no usas' : `${count} suscripciones que casi no usas`,
      label: (amount: string) =>
        `Oportunidad de ahorro: podrías ahorrar ${amount} al mes. Ver en Recomendaciones`,
    },
  },
  // Notification bodies (M9 prompt): the title is the item's name.
  reminders: {
    paymentDue: (leadDays: 0 | 1 | 2, amount: string) =>
      `${['Vence hoy', 'Vence mañana', 'Vence en 2 días'][leadDays]}: ${amount}.`,
    renewal: (leadDays: 0 | 1 | 2, date: string, amount: string) =>
      `Se renueva ${leadDays === 0 ? 'hoy' : `el ${date}`} por ${amount}.`,
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  },
  // Detalle de suscripción (M9 prompt, new screen, needs design review).
  detail: {
    back: 'Volver a Billetera',
    renews: (date: string) => `Se renueva el ${date}`,
    usage: '¿Cuánto la usas?',
    usageHelper: 'Si casi no la usas, suma a tu oportunidad de ahorro.',
    reminder: 'Recordatorio de renovación',
    reminderOn: 'Te avisaremos antes de cada cobro',
    reminderOff: 'Desactivado',
    howToCancel: 'Cómo cancelarla',
    // Until the merchant catalog (SCRUM-58 backend) gives the steps and the link.
    howToCancelGeneric:
      'Entra a la app o página del servicio y cancela desde tu cuenta. Fynk no cancela nada por ti.',
    cancelled: 'Ya la cancelé',
    confirmCancel: {
      title: (name: string) => `¿Ya cancelaste ${name}?`,
      message: 'Dejará de contar en tus gastos y no te recordaremos su renovación.',
      no: 'Todavía no',
      yes: 'Sí, ya la cancelé',
    },
    notSubscription: 'No es una suscripción',
    edit: 'Editar',
    failed: 'No pudimos guardar. Intenta de nuevo.',
    notFound: 'Esta suscripción ya no existe.',
  },
  // Lun, Mar… in the order of the weekday mask bits (Sunday first).
  weekdayShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
} as const;
