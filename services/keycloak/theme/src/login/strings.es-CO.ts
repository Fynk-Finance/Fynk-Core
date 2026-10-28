// User facing copy of the Fynk login theme (Spanish, Colombia). Texts come from the design
// (docs/design/sources/light/Login.html and Registro.html) unless a comment says otherwise.
export const strings = {
  brand: 'Fynk',
  login: {
    pageTitle: 'Iniciar sesión',
    headerTitle: 'Hola de nuevo',
    headerSubtitle: 'Cada paso cuenta para tus metas.',
    cardTitle: 'Inicia sesión',
    cardSubtitle: 'Usa el correo con el que te registraste.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Tu contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    submit: 'Ingresar',
    noAccount: '¿No tienes cuenta?',
    register: 'Regístrate',
  },
  register: {
    pageTitle: 'Crear cuenta',
    headerTitle: 'Crea tu cuenta',
    headerSubtitle: 'Tu primer paso hacia tus metas empieza aquí.',
    cardTitle: 'Regístrate',
    // Copy change decided with the team: the cédula is gone, two data are left.
    cardSubtitle: 'Solo necesitas dos datos para empezar.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Crea una contraseña',
    passwordHint: 'Mínimo 8 caracteres, con una letra y un número.',
    // New copy (not in the design): Keycloak 26 asks to repeat the password when it is on this form.
    passwordConfirmLabel: 'Confirma tu contraseña',
    passwordConfirmPlaceholder: 'Repite tu contraseña',
    submit: 'Crear cuenta',
    termsPrefix: 'Acepto los ',
    termsLink: 'Términos y condiciones',
    termsMiddle: ' y la ',
    privacyLink: 'Política de privacidad',
    termsSuffix: '.',
    haveAccount: '¿Ya tienes cuenta?',
    login: 'Inicia sesión',
  },
  // Password recovery. Step 1 text is from docs/design/sources/light/Recuperar.html (the "link" copy
  // became "code" after the team decision on 6 digit email codes). Steps 2 to 4 are not in the
  // design export: their copy is new and needs design review.
  reset: {
    pageTitle: 'Recuperar contraseña',
    headerTitle: '¿Olvidaste tu clave?',
    headerSubtitle: 'Tranquilo, te ayudamos a recuperarla.',
    backToLogin: 'Volver a iniciar sesión',
    stepLabel: (step: number, total: number) => `Paso ${step} de ${total}`,
    // Step 1
    requestTitle: 'Recupera tu acceso',
    requestSubtitle:
      'Escribe el correo de tu cuenta y te enviaremos un código para crear una nueva contraseña.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tucorreo@ejemplo.com',
    // The realm keeps the code alive 10 minutes (actionTokenGeneratedByUserLifespan). Keycloak does
    // not give the reset page that value, so the 10 is the realm's setting copied here.
    expiryNote: 'Por seguridad, el código vence en 10 minutos.',
    sendCode: 'Enviar código',
    // Step 2 (card title and subtitle; the code form is in `code`)
    codeTitle: 'Revisa tu correo',
    codeSubtitle: (email: string) => `Te enviamos un código de 6 dígitos a ${email}.`,
    verifyCode: 'Verificar código',
    changeEmail: 'Cambiar correo',
    // Step 3
    newPasswordTitle: 'Crea tu nueva contraseña',
    newPasswordSubtitle: 'Elige una contraseña que no uses en otros sitios.',
    newPasswordLabel: 'Nueva contraseña',
    newPasswordPlaceholder: 'Crea una contraseña',
    confirmLabel: 'Confirma tu contraseña',
    confirmPlaceholder: 'Repite tu contraseña',
    rulesLabel: 'Tu contraseña debe tener:',
    ruleLength: 'Mínimo 8 caracteres',
    ruleLetter: 'Una letra',
    ruleNumber: 'Un número',
    savePassword: 'Guardar contraseña',
    // Step 4
    doneHeaderTitle: '¡Todo listo!',
    doneHeaderSubtitle: 'Tu acceso quedó recuperado.',
    doneTitle: '¡Contraseña actualizada!',
    doneSubtitle:
      'Cerramos las sesiones abiertas en otros dispositivos. Ya puedes iniciar sesión con tu nueva contraseña.',
    goToLogin: 'Ir a iniciar sesión',
    goToLoginFallback: 'Vuelve a la app de Fynk para iniciar sesión.',
  },
  // Email code page (fynk-email-code.ftl). The verify composition mixes OnbCorreo.html with the
  // Fynk layout and needs design review. Server messages (wrong code, wait...) come translated.
  code: {
    verifyPageTitle: 'Verifica tu correo',
    verifyHeaderTitle: 'Verifica tu correo',
    verifyHeaderSubtitle: 'Así confirmamos que es real y que te pertenece.',
    sentTo: 'Enviamos un código de 6 dígitos a',
    label: 'Código de verificación',
    groupLabel: 'Código de 6 dígitos',
    // Reset mode shows the expiry in the blue box, as step 1 does.
    secureExpiry: (minutes: number) =>
      `Por seguridad, el código vence en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
    expiry: (minutes: number) =>
      `El código vence en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
    noCode: '¿No te llegó?',
    resendIn: 'Reenviar en',
    resend: 'Reenviar código',
    verifyInfo:
      'Verificar tu correo nos permite ayudarte a recuperar tu cuenta y avisarte de movimientos importantes. Revisa también tu carpeta de spam.',
    verifySubmit: 'Verificar correo',
  },
  // Info and error pages. New copy, needs design review.
  info: {
    pageTitle: 'Información',
    headerTitle: 'Un aviso de Fynk',
    headerSubtitle: 'Esto es lo que pasó.',
    title: 'Información',
    backToApp: 'Volver a Fynk',
    continue: 'Continuar',
  },
  error: {
    pageTitle: 'Algo salió mal',
    headerTitle: 'Algo salió mal',
    headerSubtitle: 'No pudimos completar lo que pediste.',
    title: 'No pudimos continuar',
    backToApp: 'Volver a Fynk',
    closeHint: 'Cierra esta ventana y vuelve a la app de Fynk.',
  },
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
} as const;
