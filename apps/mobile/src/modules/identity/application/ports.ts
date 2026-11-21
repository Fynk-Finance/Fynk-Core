// Ports of the identity module. Adapters implement them with react-native-app-auth and
// react-native-keychain; tests use fakes.
import type { DevicePlatform, DeviceRecord } from '../domain/device';
import type { LinkedDeviceItem } from '../domain/deviceList';
import type { Profile } from '../domain/profile';
import type { TokenSet } from '../domain/session';

export type AuthMode = 'signIn' | 'signUp';

/** What Keycloak said about the action it ran (`kc_action_status`). */
export type ActionStatus = 'success' | 'cancelled' | 'error' | 'unknown';

/**
 * Why a call to Keycloak failed:
 * - `cancelled`: the user closed the browser;
 * - `rejected`: Keycloak said no (expired or revoked session, bad request);
 * - `network`: Keycloak could not be reached.
 */
export type OidcErrorKind = 'cancelled' | 'rejected' | 'network';

export class OidcError extends Error {
  constructor(
    readonly kind: OidcErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'OidcError';
  }
}

export function isOidcError(e: unknown, kind?: OidcErrorKind): e is OidcError {
  return e instanceof OidcError && (kind === undefined || e.kind === kind);
}

/** Keycloak through OpenID Connect: Authorization Code with PKCE in the system browser. */
export interface OidcPort {
  authorize(mode: AuthMode): Promise<TokenSet>;
  /**
   * Opens Keycloak's "Cambiar contraseña" page (`kc_action=UPDATE_PASSWORD`). Keycloak asks for
   * the login first and answers with new tokens (a new Keycloak session) whatever the status.
   * Throws OidcError when the browser was closed or Keycloak could not be reached.
   */
  changePassword(): Promise<{ tokens: TokenSet; actionStatus: ActionStatus }>;
  /**
   * A fresh interactive login (`prompt=login`, `max_age=0`): Keycloak asks for the credentials
   * even when it has a session, so the new id token has a new `auth_time`. Throws OidcError.
   */
  reauthenticate(): Promise<TokenSet>;
  refresh(current: TokenSet): Promise<TokenSet>;
  /** Ends the Keycloak session of these tokens. */
  endSession(tokens: TokenSet): Promise<void>;
}

/** Where the tokens live between app starts: Keychain or Keystore, never AsyncStorage. */
export interface TokenStorePort {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

/** The person's profile in Keycloak, read through the API (`GET /me`). */
export interface ProfilePort {
  /** Throws an ApiError: `profile_not_found` (404) when the account is gone, 503 when the profile service is down. */
  getProfile(): Promise<Profile>;
}

/** Where this install's device key pair and device id live: Keychain or Keystore. */
export interface DeviceStorePort {
  load(): Promise<DeviceRecord | null>;
  save(record: DeviceRecord): Promise<void>;
}

export interface DeviceKeyPair {
  /** X25519 private key, standard base64 of 32 bytes. */
  privateKey: string;
  /** X25519 public key, standard base64 of 32 bytes. */
  publicKey: string;
}

/** X25519: makes key pairs and agrees on shared secrets. */
export interface KeyPairPort {
  generate(): DeviceKeyPair;
  /** X25519 shared secret of a stored private key (base64) and a peer's public key. */
  sharedSecret(privateKey: string, peerPublicKey: Uint8Array): Uint8Array;
}

/** Randomness for the service, so tests are deterministic. */
export interface RandomPort {
  /** A new UUID v4, used as Idempotency-Key. */
  newIdempotencyKey(): string;
}

export interface DeviceInfo {
  name: string;
  platform: DevicePlatform;
}

export interface DeviceInfoPort {
  get(): DeviceInfo;
}

export interface DeviceRegistration extends DeviceInfo {
  publicKey: string;
}

export interface LinkedDevice {
  id: string;
  name: string;
  platform: DevicePlatform;
  status: 'active' | 'pending';
}

/**
 * Why a call about devices failed:
 * - `removed`: 410 `device_removed`, this phone was removed from the account;
 * - `notFound`: 404 `device_not_found`;
 * - `keyRemoved`: 409 `device_key_removed`, the key pair belonged to a removed device;
 * - `network`: the API could not be reached;
 * - `other`: anything else.
 */
export type DevicesErrorKind = 'removed' | 'notFound' | 'keyRemoved' | 'network' | 'other';

export class DevicesError extends Error {
  constructor(
    readonly kind: DevicesErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'DevicesError';
  }
}

export function isDevicesError(e: unknown, kind?: DevicesErrorKind): e is DevicesError {
  return e instanceof DevicesError && (kind === undefined || e.kind === kind);
}

/** POST /devices and GET /devices/current. Both throw DevicesError. */
export interface DevicesApiPort {
  register(body: DeviceRegistration, idempotencyKey: string): Promise<LinkedDevice>;
  current(deviceId: string): Promise<LinkedDevice>;
}

/** GET /devices, DELETE /devices/{id} and POST /devices/sign-out-others. All throw DevicesError. */
export interface LinkedDevicesApiPort {
  /** Active and pending devices. `deviceId` marks which one is this phone. */
  list(deviceId: string | null): Promise<LinkedDeviceItem[]>;
  /** A device that is already gone counts as removed. */
  remove(id: string): Promise<void>;
  /** Removes every device except `deviceId`. */
  signOutOthers(deviceId: string): Promise<void>;
}
