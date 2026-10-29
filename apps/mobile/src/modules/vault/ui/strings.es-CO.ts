// Copy of the vault module (Spanish, Colombia).
export const vaultStrings = {
  // Not in the design: new screen, needs design review. The header is the one of Login.html.
  lock: {
    title: 'Desbloquea Fynk',
    subtitle: 'Tu información está cifrada en este teléfono.',
    password: 'Ingresar con contraseña',
    passwordHint: 'Abre el inicio de sesión de Fynk en el navegador',
    unlocking: 'Abriendo tu bóveda',
    passwordFailed: 'No pudimos verificar tu contraseña. Intenta de nuevo.',
    pendingTitle: 'Este teléfono espera aprobación',
    pendingMessage: 'Lo configuras en el siguiente paso.',
    errorTitle: 'No pudimos abrir tu bóveda',
    errors: {
      notEncrypted: 'Esta versión de la app no cifra la bóveda. Instala la versión oficial.',
      keychain: 'No pudimos leer la llave de este teléfono. Intenta de nuevo.',
      offline: 'Sin conexión. Intenta de nuevo.',
      unknown: 'Algo salió mal al abrir tu bóveda. Intenta de nuevo.',
    },
  },
} as const;
