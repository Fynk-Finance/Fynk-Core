// Public API of the identity module. Other modules import only from this file.
import { configureApiHooks } from '@shared/api';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';
import { wipe } from '@modules/vault';

import { createDevicesApi } from './adapters/api/devicesApi';
import { createKeyPairGenerator, expoRandom } from './adapters/crypto/x25519';
import { createExpoDeviceInfo } from './adapters/device/expoDeviceInfo';
import { createDeviceKeyStore } from './adapters/keychain/deviceKeyStore';
import { createKeychainTokenStore } from './adapters/keychain/keychainTokenStore';
import { createAppAuthOidc } from './adapters/oidc/appAuthOidc';
import { createOidcConfig } from './adapters/oidc/config';
import { systemClock } from './adapters/systemClock';
import { createApiHooks } from './application/apiHooks';
import { createDeviceService, type DeviceService } from './application/deviceService';
import { syncDeviceWithSession } from './application/deviceSessionSync';
import { createDevSession, shouldUseDevAuth } from './application/devSession';
import { createSessionService, type SessionState } from './application/sessionService';
import { createIdentityFlow } from './ui/IdentityFlow';
import { useSessionState } from './ui/useSessionState';

export type { SessionState };

// Development builds can skip Keycloak with EXPO_PUBLIC_DEV_AUTH=dev-token (apps/mobile/.env.example).
const useDevAuth = shouldUseDevAuth(process.env.EXPO_PUBLIC_DEV_AUTH, __DEV__);
const session = useDevAuth
  ? createDevSession()
  : createSessionService({
      oidc: createAppAuthOidc(createOidcConfig(process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER, __DEV__)),
      store: createKeychainTokenStore(),
      clock: systemClock,
    });

// The dev session has no real account, so it registers no device.
const device: DeviceService | null = useDevAuth
  ? null
  : createDeviceService({
      store: createDeviceKeyStore(),
      api: createDevicesApi(),
      keys: createKeyPairGenerator(),
      random: expoRandom,
      info: createExpoDeviceInfo(),
      // This phone was removed from the account: end the session, then erase the local data.
      onRemoved: async () => {
        await session.signOut();
        await wipe();
      },
    });

/** The registered device of this phone. Null until it is registered, and in the dev session. */
export const deviceId = (): string | null => device?.deviceId() ?? null;

// The registry imports this file at startup, so every API call carries the session from here on.
configureApiHooks(createApiHooks(session, deviceId));

// Register the phone on every sign in or restore, forget its id on sign out.
if (device) syncDeviceWithSession(session, device);

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
