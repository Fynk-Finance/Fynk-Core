// Mock Keycloak context for `pnpm dev` only. main.tsx imports this file behind `import.meta.env.DEV`,
// so it never reaches the built theme.
//   ?page=login.ftl   page to show (the only one so far)
//   &error=1          wrong credentials
import { createGetKcContextMock } from 'keycloakify/login/KcContext';
import type { KcContext } from './KcContext';

const { getKcContextMock } = createGetKcContextMock({
  kcContextExtension: { themeName: 'fynk' as const, properties: {} },
  kcContextExtensionPerPage: {},
});

export function getDevKcContext(search: string): KcContext {
  const params = new URLSearchParams(search);
  const withError = params.get('error') === '1';
  const realm = {
    registrationAllowed: true,
    resetPasswordAllowed: true,
    registrationEmailAsUsername: true,
    loginWithEmailAllowed: true,
    rememberMe: false,
    password: true,
  };

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
