// Public API of the identity module. Other modules import only from this file.
import { configureApiHooks } from '@shared/api';
import type { ModuleRoutes } from '@shared/navigation';
import { wipe } from '@modules/vault';

import { createDevicesApi } from './adapters/api/devicesApi';
import { createKeyPairGenerator, expoRandom } from './adapters/crypto/x25519';
import { createExpoDeviceInfo } from './adapters/device/expoDeviceInfo';
import { createDeviceKeyStore } from './adapters/keychain/deviceKeyStore';
import { createKeychainTokenStore } from './adapters/keychain/keychainTokenStore';
import { createAppAuthOidc } from './adapters/oidc/appAuthOidc';
import { createOidcConfig } from './adapters/oidc/config';
import { createProfileApi } from './adapters/profileApi';
import { systemClock } from './adapters/systemClock';
import { createApiHooks } from './application/apiHooks';
import { createDeviceService, type DeviceService } from './application/deviceService';
import { syncDeviceWithSession } from './application/deviceSessionSync';
import { createDevSession, shouldUseDevAuth } from './application/devSession';
import {
  createSessionService,
  type ChangePasswordResult,
  type SessionState,
} from './application/sessionService';
import { createIdentityFlow } from './ui/IdentityFlow';
import { createMiCuentaScreen } from './ui/MiCuentaScreen';
import { createSecurityScreen } from './ui/SecurityScreen';
import { SECURITY_ROUTE } from './ui/miCuentaRows';
import { useSessionState } from './ui/useSessionState';

export type { SessionState };
export { MiCuentaHeader, type MiCuentaHeaderProps } from './ui/MiCuentaHeader';

// Development builds can skip Keycloak with EXPO_PUBLIC_DEV_AUTH=dev-token (apps/mobile/.env.example).
const useDevAuth = shouldUseDevAuth(process.env.EXPO_PUBLIC_DEV_AUTH, __DEV__);
const session = useDevAuth
  ? createDevSession()
  : createSessionService({
      oidc: createAppAuthOidc(createOidcConfig(process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER, __DEV__)),
      store: createKeychainTokenStore(),
      clock: systemClock,
    });

const devicesApi = createDevicesApi();

// The dev session has no real account, so it registers no device.
const device: DeviceService | null = useDevAuth
  ? null
  : createDeviceService({
      store: createDeviceKeyStore(),
      api: devicesApi,
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

/**
 * Keycloak's change password page. A new Keycloak session replaces the app's one, so the device
 * is checked again afterwards: the API moves its stored session id to the new session.
 */
const changePassword = async (): Promise<ChangePasswordResult> => {
  const result = await session.changePassword();
  if (session.getState().status === 'signedIn') await device?.sync().catch(() => undefined);
  return result;
};

// Seguridad (change password and linked devices), pushed with the default transition
// (inventory row 16). Exported as LinkedDevicesScreen, the name the M1 prompt lists.
export const LinkedDevicesScreen = createSecurityScreen({
  profile: createProfileApi(),
  devices: devicesApi,
  clock: systemClock,
  changePassword,
  deviceId,
  sync: async () => device?.sync(),
  signOut: () => session.signOut(),
});

export const routes: ModuleRoutes = {
  module: 'identity',
  flow: createIdentityFlow(session),
  // Open (shows the flow) until there is a session, including while it is being restored.
  useGate: () => useSession().status !== 'signedIn',
  screens: [
    {
      // Mi cuenta, pushed with the default transition (inventory row 7).
      name: 'identity.Account',
      component: createMiCuentaScreen({
        profile: createProfileApi(),
        signOut: () => session.signOut(),
      }),
      path: 'cuenta',
    },
    {
      name: SECURITY_ROUTE,
      component: LinkedDevicesScreen,
      path: 'cuenta/seguridad',
    },
  ],
};
