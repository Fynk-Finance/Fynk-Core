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
} as const;
