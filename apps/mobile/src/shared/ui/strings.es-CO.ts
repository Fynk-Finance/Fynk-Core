// Copy of the shared design system components (Spanish, Colombia).
export const uiStrings = {
  greeting: 'Hola,',
  notifications: 'Notificaciones',
  notificationsUnread: 'Notificaciones, tienes avisos sin leer',
  statistics: 'Estadísticas',
  myAccount: (name: string) => `Mi cuenta: ${name}`,
  back: 'Volver',
  skip: 'Omitir',
  step: (current: number, total: number) => `Paso ${current} de ${total}`,
  stepProgress: 'Progreso de la configuración',
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
  seeAll: 'Ver todos',
  retry: 'Reintentar',
  loading: 'Cargando',
  errorTitle: 'Algo salió mal',
  errorMessage: 'No pudimos cargar esta información. Intenta de nuevo.',
  simulated: 'Simulado',
  // The Fynk dialog: its only button when none is given, and closing it from outside.
  dialogOk: 'Entendido',
  dialogDismiss: 'Cerrar',
  tabs: {
    dashboard: 'Dashboard',
    wallet: 'Billetera',
    recommendations: 'Recomendaciones',
    investment: 'Inversión',
  },
} as const;
