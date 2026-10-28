// Public API of the identity module. Other modules import only from this file.
import { configureApiHooks } from '@shared/api';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { createKeychainTokenStore } from './adapters/keychain/keychainTokenStore';
import { createAppAuthOidc } from './adapters/oidc/appAuthOidc';
import { createOidcConfig } from './adapters/oidc/config';
import { systemClock } from './adapters/systemClock';
import { createApiHooks } from './application/apiHooks';
import { createDevSession, shouldUseDevAuth } from './application/devSession';
import { createSessionService, type SessionState } from './application/sessionService';
import { createIdentityFlow } from './ui/IdentityFlow';
import { useSessionState } from './ui/useSessionState';

export type { SessionState };

// Development builds can skip Keycloak with EXPO_PUBLIC_DEV_AUTH=dev-token (apps/mobile/.env.example).
const session = shouldUseDevAuth(process.env.EXPO_PUBLIC_DEV_AUTH, __DEV__)
  ? createDevSession()
  : createSessionService({
      oidc: createAppAuthOidc(createOidcConfig(process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER, __DEV__)),
      store: createKeychainTokenStore(),
      clock: systemClock,
    });

/** The registered device, once device registration lands (M1 branch 6). Null until then. */
export const deviceId = (): string | null => null;

// The registry imports this file at startup, so every API call carries the session from here on.
configureApiHooks(createApiHooks(session, deviceId));

export const useSession = (): SessionState => useSessionState(session);
export const getAccessToken = () => session.getAccessToken();
export const signIn = () => session.signIn();
export const signUp = () => session.signUp();
export const signOut = () => session.signOut();

export const routes: ModuleRoutes = {
  module: 'identity',
  flow: createIdentityFlow(session),
  // Open (shows the flow) until there is a session, including while it is being restored.
  useGate: () => useSession().status !== 'signedIn',
  screens: [
    {
      // M1 branch 6 replaces it with Mi cuenta and the linked devices.
      name: 'identity.Account',
      component: createPlaceholderScreen({ title: 'Mi cuenta', owner: 'M1 · Identidad' }),
      path: 'cuenta',
    },
  ],
};
