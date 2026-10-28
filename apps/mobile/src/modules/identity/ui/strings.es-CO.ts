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
} as const;
