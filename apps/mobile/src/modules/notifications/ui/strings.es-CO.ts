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
