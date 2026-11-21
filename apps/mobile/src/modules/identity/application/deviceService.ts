// Registers this phone as a linked device after sign in and detects that it was removed.
import { fromBase64, type DeviceRecord } from '../domain/device';
import {
  isDevicesError,
  type LinkedDevice,
  type DeviceInfoPort,
  type DevicesApiPort,
  type DeviceStorePort,
  type KeyPairPort,
  type RandomPort,
} from './ports';

export interface DeviceService {
  /** Id of this device once registered. Null before the first sync loads it. */
  deviceId(): string | null;
  /** Registers the device, or checks it is still linked. Concurrent calls share one run. */
  sync(): Promise<void>;
  /**
   * This phone as the API knows it (`GET /devices/current`). Null when it is not registered
   * yet or the API does not know it. A removed device is handled as in sync(). Throws a
   * DevicesError when the API cannot be reached.
   */
  current(): Promise<Pick<LinkedDevice, 'id' | 'status'> | null>;
  /** The X25519 public key of this phone, or null before the key pair exists. */
  publicKey(): Promise<Uint8Array | null>;
  /**
   * X25519 shared secret of this phone's private key and a peer's public key. The private key
   * never leaves this service. Throws when the peer key is not 32 bytes or there is no key pair.
   */
  sharedSecret(peerPublicKey: Uint8Array): Promise<Uint8Array>;
  /** Sign out: forgets the device id and keeps the key pair. */
  forget(): Promise<void>;
}

export interface DeviceServiceDeps {
  store: DeviceStorePort;
  api: DevicesApiPort;
  keys: KeyPairPort;
  random: RandomPort;
  info: DeviceInfoPort;
  /** This phone was removed from the account: sign out and wipe the vault. */
  onRemoved: () => void | Promise<void>;
}

const withoutId = (r: DeviceRecord): DeviceRecord => ({
  v: 1,
  privateKey: r.privateKey,
  publicKey: r.publicKey,
});

export function createDeviceService(deps: DeviceServiceDeps): DeviceService {
  const { store, api, keys, random, info } = deps;
  let currentId: string | null = null;
  let running: Promise<void> | null = null;
  // Bumped by forget(), so a run that finishes after a sign out does not keep its device id.
  let generation = 0;

  /** Registers once; after `keyRemoved` it makes a new key pair and tries one more time. */
  const register = async (start: DeviceRecord, gen: number): Promise<void> => {
    let record = start;
    for (let attempt = 0; attempt < 2; attempt++) {
      const key = record.idempotencyKey ?? random.newIdempotencyKey();
      if (record.idempotencyKey !== key) {
        // Saved first, so a crash during the call retries with the same key.
        record = { ...record, idempotencyKey: key };
        await store.save(record);
      }
      try {
        const { name, platform } = info.get();
        const device = await api.register({ name, platform, publicKey: record.publicKey }, key);
        if (gen !== generation) return;
        await store.save({ ...withoutId(record), deviceId: device.id });
        currentId = device.id;
        return;
      } catch (e) {
        if (!isDevicesError(e, 'keyRemoved') || attempt === 1) return;
        record = { v: 1, ...keys.generate(), idempotencyKey: random.newIdempotencyKey() };
        await store.save(record);
      }
    }
  };

  /** This phone was removed from the account: forget the id, then sign out and wipe. */
  const handleRemoved = async (record: DeviceRecord) => {
    currentId = null;
    await store.save(withoutId(record));
    await deps.onRemoved();
  };

  const run = async (): Promise<void> => {
    const gen = generation;
    let record = await store.load();
    if (gen !== generation) return; // signed out while reading the Keychain
    if (!record) {
      record = { v: 1, ...keys.generate() };
      await store.save(record);
    }
    currentId = record.deviceId ?? null;
    if (record.deviceId) {
      try {
        await api.current(record.deviceId);
        return;
      } catch (e) {
        if (isDevicesError(e, 'removed')) {
          await handleRemoved(record);
          return;
        }
        if (!isDevicesError(e, 'notFound')) return; // offline or server trouble: next time
        currentId = null;
        record = withoutId(record);
        await store.save(record);
      }
    }
    await register(record, gen);
  };

  return {
    deviceId: () => currentId,
    sync() {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
    async current() {
      const record = await store.load();
      if (!record?.deviceId) return null;
      try {
        const device = await api.current(record.deviceId);
        return { id: device.id, status: device.status };
      } catch (e) {
        if (isDevicesError(e, 'removed')) {
          await handleRemoved(record);
          return null;
        }
        if (isDevicesError(e, 'notFound')) return null; // the next sync registers it again
        throw e;
      }
    },
    async publicKey() {
      const record = await store.load();
      return record ? fromBase64(record.publicKey) : null;
    },
    async sharedSecret(peerPublicKey) {
      if (peerPublicKey.length !== 32) throw new Error('peer public key must be 32 bytes');
      const record = await store.load();
      if (!record) throw new Error('no device key pair');
      return keys.sharedSecret(record.privateKey, peerPublicKey);
    },
    async forget() {
      generation += 1;
      currentId = null;
      const record = await store.load();
      if (record?.deviceId) await store.save(withoutId(record));
    },
  };
}
