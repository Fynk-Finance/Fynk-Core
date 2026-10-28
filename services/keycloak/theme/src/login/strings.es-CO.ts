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
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
} as const;
