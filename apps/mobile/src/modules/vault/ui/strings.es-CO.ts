// Copy of the vault module (Spanish, Colombia).
export const vaultStrings = {
  // Not in the design: new screen, needs design review. The header is the one of Login.html.
  lock: {
    title: 'Desbloquea Fynk',
    subtitle: 'Tu información está cifrada en este teléfono.',
    biometric: 'Huella o Face ID',
    orWith: 'o ingresa con',
    biometricHint: 'Abre tu bóveda con la huella o el rostro de este teléfono',
    password: 'Ingresar con contraseña',
    passwordHint: 'Abre el inicio de sesión de Fynk en el navegador',
    unlocking: 'Abriendo tu bóveda',
    passwordFailed: 'No pudimos verificar tu contraseña. Intenta de nuevo.',
    pendingTitle: 'Este teléfono espera aprobación',
    pendingMessage: 'Lo configuras en el siguiente paso.',
    notices: {
      biometricsOff:
        'Cambiaron las huellas o el rostro del teléfono. Desactivamos la biometría de Fynk: ingresa con tu contraseña.',
      biometricFailed:
        'No pudimos usar la biometría. Intenta de nuevo o ingresa con tu contraseña.',
    },
    errorTitle: 'No pudimos abrir tu bóveda',
    errors: {
      notEncrypted: 'Esta versión de la app no cifra la bóveda. Instala la versión oficial.',
      keychain: 'No pudimos leer la llave de este teléfono. Intenta de nuevo.',
      offline: 'Sin conexión. Intenta de nuevo.',
      unknown: 'Algo salió mal al abrir tu bóveda. Intenta de nuevo.',
    },
  },
  // Not in the design: needs design review. The row texts are those of CfgSeguridad.html.
  biometric: {
    prompt: {
      title: 'Desbloquea Fynk',
      subtitle: 'Usa tu huella o tu rostro',
      cancel: 'Cancelar',
    },
    card: 'Desbloqueo',
    switchLabel: 'Face ID o huella',
    switchHint: 'Abre Fynk sin escribir tu contraseña',
    failed: 'No pudimos cambiar esta opción. Intenta de nuevo.',
  },
} as const;
