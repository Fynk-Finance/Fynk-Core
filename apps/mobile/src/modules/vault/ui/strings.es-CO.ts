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
  // Not in the design: new screen, needs design review. Old phone side of a device approval (HU-046).
  approve: {
    title: 'Aprobar nuevo dispositivo',
    subtitle: 'Aprueba solo si el código es el mismo que ves en tu otro teléfono.',
    back: 'Volver',
    prompt: {
      title: 'Aprueba el nuevo dispositivo',
      subtitle: 'Usa tu huella o tu rostro',
      cancel: 'Cancelar',
    },
    platform: { ios: 'iPhone', android: 'Android' },
    codeLabel: 'Verifica que tu otro teléfono muestre este código',
    expiresIn: (minutes: number) => `Vence en ${minutes} min`,
    approve: 'Aprobar',
    approveHint: 'Comparte tu bóveda cifrada con este teléfono',
    reject: 'Rechazar',
    busy: 'Aprobando…',
    empty: 'No hay solicitudes pendientes.',
    devices: 'Ver dispositivos vinculados',
    messages: {
      approved: 'Listo. Tu nuevo teléfono ya puede ver tus datos.',
      rejected: 'Rechazaste la solicitud.',
      expired: 'La solicitud venció. Pide una nueva desde el otro teléfono.',
      notPending: 'Esta solicitud ya no está disponible.',
      offline: 'No pudimos conectarnos. Intenta de nuevo.',
      failed: 'No pudimos completar la aprobación. Intenta de nuevo.',
    },
    notification: {
      title: 'Nuevo dispositivo',
      body: (deviceName: string) =>
        `${deviceName} quiere acceder a tu cuenta. Revisa el código antes de aprobar.`,
    },
  },
  // Not in the design: new screen, needs design review. The code input follows OnbCorreo.html.
  restore: {
    title: 'Restaurar en un teléfono nuevo',
    message:
      'Para ver tus metas y gastos manuales en este teléfono, usa tu código de recuperación o aprueba desde tu otro teléfono.',
    codeOption: 'Usar mi código de recuperación',
    codeOptionHint: 'Escribe el código de 26 letras y números que guardaste',
    approvalOption: 'Aprobar desde mi otro teléfono',
    approvalOptionHint: 'Tu otro teléfono con Fynk te pasa la llave después de que lo apruebes',
    approval: {
      starting: 'Pidiendo aprobación…',
      instruction:
        'Abre Fynk en tu otro teléfono y aprueba este dispositivo. Verifica que muestre este código.',
      codeLabel: 'Código de verificación',
      waiting: 'Esperando aprobación…',
      cancel: 'Cancelar',
      retry: 'Pedir de nuevo',
      messages: {
        rejected: 'La solicitud fue rechazada en tu otro teléfono.',
        expired: 'La solicitud venció.',
        grantLost: 'No pudimos recibir la llave. Usa tu código de recuperación.',
        alreadyActive: 'Este teléfono ya está activo. Usa tu código de recuperación.',
        offline: 'No pudimos conectarnos. Intenta de nuevo.',
        startFailed: 'No pudimos pedir la aprobación. Intenta de nuevo.',
        failed: 'No pudimos restaurar tus datos. Si no funciona, usa tu código de recuperación.',
      },
    },
    resetOption: 'No tengo ninguno de los dos',
    reset: {
      lost: 'Sin tu otro teléfono ni tu código, no podemos recuperar tus metas, gastos manuales, topes ni marcas de uso. Nadie puede: están cifrados con una llave que solo tú tenías.',
      reload:
        'Tus cuentas y movimientos se vuelven a cargar desde tu banco (los últimos 12 meses).',
      confirm:
        'Para empezar de cero, primero confirma que eres tú: restablece tu contraseña con el código que te enviamos por correo y vuelve a iniciar sesión.',
      start: 'Empezar de cero',
      back: 'Volver',
      resetPassword: 'Restablecer contraseña',
      messages: {
        notAllowed:
          'Primero restablece tu contraseña. Cerraremos tu sesión para que lo hagas desde «¿Olvidaste tu contraseña?».',
        notActive: 'Este teléfono fue retirado de tu cuenta.',
        offline: 'No pudimos conectarnos. Intenta de nuevo.',
        failed: 'No pudimos empezar de cero. Intenta de nuevo.',
      },
    },
    inputLabel: 'Código de recuperación',
    inputPlaceholder: 'XXXXX XXXXX XXXXX XXXXX XXXXXX',
    submit: 'Restaurar',
    restoring: 'Restaurando tus datos…',
    signOut: 'Cerrar sesión',
    errors: {
      invalid: 'Revisa el código: son 26 letras y números.',
      wrongCode: 'El código no es correcto.',
      tooMany: 'Hiciste demasiados intentos. Intenta de nuevo en una hora.',
      noBackup: 'Esta cuenta no tiene un respaldo con código.',
      removed: 'Este teléfono fue retirado de tu cuenta.',
      offline: 'No pudimos conectarnos. Intenta de nuevo.',
      failed: 'No pudimos restaurar tus datos. Intenta de nuevo.',
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
  // Not in the design: new screen, needs design review. Card style of OnbListo.html, input of
  // OnbCorreo.html.
  recovery: {
    title: 'Guarda tu código de recuperación',
    subtitle:
      'Con este código recuperas tus datos en un teléfono nuevo. Anótalo o guárdalo en un lugar seguro, fuera de Fynk.',
    codeLabel: 'Tu código de recuperación',
    copy: 'Copiar',
    copied: 'Copiado',
    copyHint: 'Copia el código para guardarlo en otra parte',
    saved: 'Ya lo guardé',
    warning:
      'Si pierdes tu teléfono y este código, no podremos recuperar tus metas ni tus gastos manuales.',
    confirmTitle: 'Escribe el último grupo de tu código',
    confirmSubtitle: 'Así comprobamos que lo guardaste bien.',
    inputLabel: 'Último grupo del código',
    inputPlaceholder: 'Último grupo',
    confirm: 'Confirmar',
    seeCode: 'Ver el código otra vez',
    close: 'Cerrar',
    errors: {
      mismatch: 'Ese grupo no coincide. Revisa tu código.',
      offline: 'Sin conexión. Conéctate a internet e intenta de nuevo.',
      failed: 'No pudimos guardar tu código. Intenta de nuevo.',
    },
    // Seguridad › "Código de recuperación" (row of CfgSeguridad, new, needs design review).
    row: {
      section: 'Código de recuperación',
      title: 'Generar un código nuevo',
      hint: 'El código anterior deja de funcionar',
    },
    newCode: {
      preparing: 'Preparando tu código',
      failedTitle: 'No pudimos preparar tu código',
      failedMessage: 'Revisa tu conexión e intenta de nuevo desde Seguridad.',
    },
  },
} as const;
