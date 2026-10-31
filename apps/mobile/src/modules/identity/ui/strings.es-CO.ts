// Copy of the identity module (Spanish, Colombia).
export const identityStrings = {
  inicio: {
    // VerdeInicio.dc.html
    titleStart: 'Toma el control de',
    titleHighlight: 'tu dinero',
    subtitle: 'Conecta tus bancos y organiza tu presupuesto en un solo lugar',
    start: 'Empezar',
    startHint: 'Abre el registro de Fynk en el navegador',
    illustration:
      'Ilustración de dos tarjetas bancarias, azul y verde limón, junto a una pila de monedas',
    // Not in the design: new, needs design review.
    signIn: 'Ya tengo cuenta',
    signInHint: 'Abre el inicio de sesión de Fynk en el navegador',
    errors: {
      network: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
      unknown: 'No pudimos iniciar tu sesión. Intenta de nuevo.',
    },
  },
  restoring: 'Abriendo tu sesión',
  // DetalleCuentas.html (Mi cuenta)
  miCuenta: {
    title: 'Mi cuenta',
    fallbackName: 'Tu cuenta',
    verified: 'Perfil verificado',
    verifiedHint: 'Tu correo está verificado',
    basicInfo: 'Información Básica',
    recoveryEmail: 'Correo de recuperación',
    memberSince: 'Miembro desde',
    management: 'Gestión de cuenta',
    // Not in the design: new, needs design review.
    retryFailed: 'No pudimos cargar tu perfil. Intenta de nuevo.',
    rows: {
      security: { title: 'Seguridad', subtitle: 'Contraseña, huella y Face ID' },
      // Not in the design: new, needs design review.
      appearance: { title: 'Apariencia', subtitle: 'Claro, oscuro o el del teléfono' },
      signOut: { title: 'Cerrar sesión', subtitle: 'Salir de Fynk en este dispositivo' },
    },
    // Not in the design: new, needs design review.
    signOutConfirm: {
      title: '¿Cerrar sesión?',
      message: 'Saldrás de Fynk en este dispositivo.',
      cancel: 'Cancelar',
      confirm: 'Cerrar sesión',
    },
  },
  // CfgSeguridad.html (Seguridad)
  security: {
    title: 'Seguridad',
    subtitle: 'Protege tu cuenta y controla dónde está abierta.',
    back: 'Volver a Mi cuenta',
    password: 'Contraseña',
    changePassword: 'Cambiar contraseña',
    changePasswordHint: 'Abre la página de Fynk en el navegador para elegir una contraseña nueva',
    passwordUpdated: 'Actualizada',
    devices: 'Dispositivos activos',
    thisDevice: 'Este dispositivo',
    activeNow: 'Activo ahora',
    close: 'Cerrar',
    closeAll: 'Cerrar todas las demás sesiones',
    footer: 'Si no reconoces un dispositivo, ciérralo y cambia tu contraseña.',
    // Not in the design: new, needs design review.
    pending: 'Pendiente',
    pendingHint: 'Este dispositivo espera aprobación',
    closeDevice: (name: string) => `Cerrar la sesión de ${name}`,
    approve: 'Aprobar',
    approveDevice: (name: string) => `Aprobar el acceso de ${name}`,
    loadFailed: 'No pudimos cargar tus dispositivos. Intenta de nuevo.',
    changeFailed: {
      title: 'No pudimos cambiar tu contraseña',
      message: 'Intenta de nuevo en unos minutos.',
    },
    actionFailed: {
      title: 'No pudimos cerrar la sesión',
      message: 'Revisa tu conexión e intenta de nuevo.',
    },
    confirmClose: {
      title: (name: string) => `¿Cerrar la sesión de ${name}?`,
      message: 'Ese dispositivo dejará de tener acceso a tu cuenta.',
      cancel: 'Cancelar',
      confirm: 'Cerrar sesión',
    },
    confirmCloseAll: {
      title: '¿Cerrar las demás sesiones?',
      message: 'Todos los dispositivos, menos este, dejarán de tener acceso a tu cuenta.',
      cancel: 'Cancelar',
      confirm: 'Cerrar todas',
    },
  },
} as const;
