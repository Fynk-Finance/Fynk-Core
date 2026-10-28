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
} as const;
