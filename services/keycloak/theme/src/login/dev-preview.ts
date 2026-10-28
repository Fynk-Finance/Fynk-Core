// Mock Keycloak context for `pnpm dev` only. main.tsx imports this file behind `import.meta.env.DEV`,
// so it never reaches the built theme.
//   ?page=login.ftl | register.ftl | login-reset-password.ftl | fynk-email-code.ftl |
//         login-update-password.ftl | info.ftl | error.ftl      page to show (default login.ftl)
//   &error=1                          login: wrong credentials, register: server errors,
//                                     login-reset-password and login-update-password: field errors
//   &password=0                       register: without the password fields (the realm always asks for it)
//   fynk-email-code.ftl:  &purpose=verify | reset (default verify)
//                         &error=wrong | new | malformed | many | wait
//                         &cooldown=42  seconds left before "Reenviar código" (default 0)
//   info.ftl:  &kind=reset (end of the password recovery) | generic (default reset)
//   error.ftl: &link=0 (the client has no base URL)
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

function fieldErrors(fields: Record<string, string>) {
  return {
    existsError: (...names: string[]) => names.some((name) => name in fields),
    exists: (name: string) => name in fields,
    get: (name: string) => fields[name] ?? '',
    getFirstError: (...names: string[]) => names.map((name) => fields[name]).find(Boolean) ?? '',
  };
}

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

  if (page === 'login-reset-password.ftl') {
    return getKcContextMock({
      pageId: 'login-reset-password.ftl',
      overrides: {
        realm,
        auth: { attemptedUsername: withError ? 'laura.gomez@correo' : '' },
        ...(withError && {
          messagesPerField: fieldErrors({ username: 'Correo no válido.' }),
        }),
      },
    });
  }

  if (page === 'login-update-password.ftl') {
    return getKcContextMock({
      pageId: 'login-update-password.ftl',
      overrides: {
        realm,
        ...(withError && {
          messagesPerField: fieldErrors({
            password: 'Contraseña no válida: no puede ser igual que el correo.',
          }),
        }),
      },
    });
  }

  if (page === 'info.ftl') {
    const reset = (params.get('kind') ?? 'reset') === 'reset';
    return getKcContextMock({
      pageId: 'info.ftl',
      overrides: {
        realm,
        skipLink: reset,
        message: {
          type: 'success',
          summary: reset
            ? 'Tu cuenta se ha actualizado.'
            : 'Tu correo se verificó. Puedes volver a la app.',
        },
        ...(!reset && {
          messageHeader: 'Correo verificado',
          client: { baseUrl: 'co.fynk.app://oauth/callback' },
        }),
        ...(reset && { messageHeader: '', client: { baseUrl: undefined } }),
      },
    });
  }

  if (page === 'error.ftl') {
    return getKcContextMock({
      pageId: 'error.ftl',
      overrides: {
        realm,
        message: {
          type: 'error',
          summary: 'Tu sesión venció. Vuelve a la app e inicia el proceso otra vez.',
        },
        client: {
          baseUrl: params.get('link') === '0' ? undefined : 'co.fynk.app://oauth/callback',
        },
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
