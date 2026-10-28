// Mock Keycloak context for `pnpm dev` only. main.tsx imports this file behind `import.meta.env.DEV`,
// so it never reaches the built theme.
//   ?page=login.ftl | register.ftl | fynk-email-code.ftl   page to show (default login.ftl)
//   &error=1                          login: wrong credentials, register: server errors
//   &password=0                       register: without the password fields (the realm always asks for it)
//   fynk-email-code.ftl:  &purpose=verify | reset (default verify)
//                         &error=wrong | new | malformed | many | wait
//                         &cooldown=42  seconds left before "Reenviar código" (default 0)
import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import type { KcContext } from './KcContext';

const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension: { themeName: 'fynk' as const, properties: {} },
  kcContextExtensionPerPage: {
    'fynk-email-code.ftl': {
      purpose: 'verify' as 'verify' | 'reset',
      email: 'laura.gomez@correo.com',
      minutes: 10,
      cooldownSeconds: 0,
    },
  },
});

// The messages the email-code extension sets (messages_es.properties), already translated.
const codeMessages: Record<string, string> = {
  wrong: 'El código no es correcto. Te quedan 4 intentos.',
  new: 'Este código ya no sirve. Pide uno nuevo.',
  malformed: 'Escribe los 6 dígitos del código.',
  many: 'Hiciste demasiados intentos fallidos. Inténtalo de nuevo más tarde.',
  wait: 'Espera 42 segundos para pedir otro código.',
};

export function getDevKcContext(search: string): KcContext {
  const params = new URLSearchParams(search);
  const page = params.get('page') ?? 'login.ftl';
  const withError = params.get('error') === '1';
  const realm = {
    registrationAllowed: true,
    resetPasswordAllowed: true,
    registrationEmailAsUsername: true,
    loginWithEmailAllowed: true,
    rememberMe: false,
    password: true,
  };

  if (page === 'register.ftl') {
    return getKcContextMock({
      pageId: 'register.ftl',
      overrides: {
        realm,
        passwordRequired: params.get('password') !== '0',
        termsAcceptanceRequired: true,
        ...(withError && {
          messagesPerField: {
            existsError: (name: string) => name === 'termsAccepted',
            exists: (name: string) => name === 'termsAccepted',
            get: () => 'Debes aceptar los términos y condiciones.',
          },
        }),
      },
    });
  }

  if (page === 'fynk-email-code.ftl') {
    const error = params.get('error') ?? '';
    return getKcContextMock({
      pageId: 'fynk-email-code.ftl',
      overrides: {
        realm,
        purpose: params.get('purpose') === 'reset' ? 'reset' : 'verify',
        cooldownSeconds: Number(params.get('cooldown') ?? '0'),
        ...(codeMessages[error] !== undefined && {
          message: { type: 'error', summary: codeMessages[error] },
        }),
      },
    });
  }

  return getKcContextMock({
    pageId: 'login.ftl',
    overrides: {
      realm,
      ...(withError && {
        message: { type: 'error', summary: 'Correo o contraseña incorrectos.' },
        messagesPerField: {
          existsError: () => true,
          getFirstError: () => 'Correo o contraseña incorrectos.',
        },
      }),
    },
  });
}
