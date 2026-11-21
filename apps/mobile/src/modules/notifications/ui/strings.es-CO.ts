// User facing copy of the notifications module (Spanish, Colombia).
export const notificationsStrings = {
  inbox: {
    title: 'Notificaciones',
    back: 'Volver',
    unread: (n: number) => `${n} sin leer`,
    markAllRead: 'Marcar como leídas',
    sections: {
      today: 'Hoy',
      thisWeek: 'Esta semana',
      earlier: 'Antes',
    },
    unreadDot: 'Sin leer',
    empty: 'No tienes avisos por ahora.',
    error: 'No pudimos cargar tus avisos.',
  },
  // Ajustes de notificaciones (design CfgNotificaciones). Rows marked "new" are not in the design.
  settings: {
    title: 'Notificaciones',
    subtitle: 'Elige qué avisos quieres recibir.',
    back: 'Volver a Mi cuenta',
    allowAll: {
      title: 'Permitir notificaciones',
      subtitle: 'Recibirás los avisos que elijas abajo',
    },
    sections: {
      payments: 'Pagos y gastos fijos',
      money: 'Movimientos y saldos',
      goals: 'Metas y recomendaciones',
      security: 'Seguridad', // new
    },
    rows: {
      payments: { title: 'Recordatorio de pagos', subtitle: 'Antes de que venza un gasto fijo' },
      renewals: {
        title: 'Cobro de suscripciones',
        subtitle: 'Cuando se renueve una suscripción',
      },
      priceUp: { title: 'Aumentos de precio', subtitle: 'Cuando una suscripción suba de precio' }, // new
      income: { title: 'Ingresos recibidos', subtitle: 'Cuando entre dinero a tus cuentas' },
      sync: { title: 'Sincronización', subtitle: 'Cuando tus cuentas se actualicen' }, // new
      caps: { title: 'Topes de gasto', subtitle: 'Al llegar al 80 % y al 100 % de un tope' }, // new
      // The design says 25, 50, 75 y 100 %; the M8 prompt notifies at 50, 75 and 100 %.
      goals: { title: 'Avance de metas', subtitle: 'Cuando llegues al 50, 75 y 100 %' },
      recommendations: {
        title: 'Nuevas recomendaciones',
        subtitle: 'Ideas para ahorrar según tus gastos',
      },
      devices: { title: 'Nuevos dispositivos', subtitle: 'Siempre activo, por tu seguridad' }, // new
    },
    leadDays: {
      label: 'Cuándo avisar',
      options: { 0: 'El mismo día', 1: '1 día antes', 2: '2 días antes' },
    },
    error: 'No pudimos cargar tus ajustes.',
  },
  // Shown once, before the phone asks for permission (new UI, needs design review).
  permission: {
    title: 'Activa los recordatorios',
    message:
      'Fynk te avisará en este teléfono antes de cada pago y cuando avances en tus metas, aunque la app esté cerrada. Con el teléfono bloqueado no se ven los montos.',
    later: 'Ahora no',
    allow: 'Continuar',
  },
  lockScreen: {
    // iOS shows it instead of the body when previews are hidden on the lock screen.
    hiddenBody: 'Abre Fynk para ver el detalle.',
    channelName: 'Recordatorios',
  },
} as const;
