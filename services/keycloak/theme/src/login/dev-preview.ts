// Mock Keycloak context for `pnpm dev` only. main.tsx imports this file behind `import.meta.env.DEV`,
// so it never reaches the built theme.
//   ?page=login.ftl | register.ftl   page to show (default login.ftl)
//   &error=1                          login: wrong credentials, register: server errors
//   &password=0                       register: without the password fields (the realm always asks for it)
import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import type { KcContext } from './KcContext';

const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension: { themeName: 'fynk' as const, properties: {} },
  kcContextExtensionPerPage: {},
});

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
