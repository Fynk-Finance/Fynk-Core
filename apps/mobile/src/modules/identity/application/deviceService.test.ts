import { createKeyPairGenerator } from '../adapters/crypto/x25519';
import { fromBase64, toBase64, type DeviceRecord } from '../domain/device';
import { createDeviceService, type DeviceServiceDeps } from './deviceService';
import {
  DevicesError,
  type DeviceKeyPair,
  type DevicesApiPort,
  type DevicesErrorKind,
  type LinkedDevice,
} from './ports';

jest.mock('expo-crypto', () => ({ getRandomBytes: jest.fn(), randomUUID: jest.fn() }));

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

const pair = (n: number): DeviceKeyPair => ({
  privateKey: toBase64(new Uint8Array(32).fill(n)),
  publicKey: toBase64(new Uint8Array(32).fill(n + 100)),
});
const linked = (id: string): LinkedDevice => ({
  id,
  name: 'Pixel 8',
  platform: 'android',
  status: 'active',
});

const realKeys = createKeyPairGenerator();

function setup(initial: DeviceRecord | null = null) {
  let stored = initial;
  let pairs = 0;
  let uuids = 0;
  const register = jest.fn<
    ReturnType<DevicesApiPort['register']>,
    Parameters<DevicesApiPort['register']>
  >(async () => linked('dev-1'));
  const current = jest.fn<
    ReturnType<DevicesApiPort['current']>,
    Parameters<DevicesApiPort['current']>
  >(async (id) => linked(id));
  const onRemoved = jest.fn(async () => undefined);
  const deps: DeviceServiceDeps = {
    store: {
      load: async () => stored,
      save: async (r) => {
        stored = r;
      },
    },
    api: { register, current },
    keys: { generate: () => pair(++pairs), sharedSecret: realKeys.sharedSecret },
    random: { newIdempotencyKey: () => `key-${++uuids}` },
    info: { get: () => ({ name: 'Pixel 8', platform: 'android' as const }) },
    onRemoved,
  };
  return { service: createDeviceService(deps), register, current, onRemoved, stored: () => stored };
}

const registered = (id = 'dev-1'): DeviceRecord => ({ v: 1, ...pair(1), deviceId: id });
const fail = (kind: DevicesErrorKind): never => {
  throw new DevicesError(kind);
};

it('first sync creates a key pair, saves the idempotency key first, then stores the id', async () => {
  const t = setup();
  expect(t.service.deviceId()).toBeNull();
  t.register.mockImplementationOnce(async () => {
    expect(t.stored()?.idempotencyKey).toBe('key-1');
    return linked('dev-1');
  });
  await t.service.sync();
  expect(t.register).toHaveBeenCalledWith(
    { name: 'Pixel 8', platform: 'android', publicKey: pair(1).publicKey },
    'key-1',
  );
  expect(t.stored()).toEqual({ v: 1, ...pair(1), deviceId: 'dev-1' });
  expect(t.service.deviceId()).toBe('dev-1');
});

it('a second sync checks the device and does not register', async () => {
  const t = setup();
  await t.service.sync();
  await t.service.sync();
  expect(t.register).toHaveBeenCalledTimes(1);
  expect(t.current).toHaveBeenCalledWith('dev-1');
});

it('loads a stored id at the start of sync', async () => {
  const t = setup(registered('dev-9'));
  expect(t.service.deviceId()).toBeNull();
  await t.service.sync();
  expect(t.service.deviceId()).toBe('dev-9');
  expect(t.register).not.toHaveBeenCalled();
});

it('registers again with the same public key when the server does not know the device', async () => {
  const t = setup(registered('dev-old'));
  t.current.mockImplementationOnce(async () => fail('notFound'));
  t.register.mockResolvedValueOnce(linked('dev-new'));
  await t.service.sync();
  expect(t.register.mock.calls[0]![0].publicKey).toBe(pair(1).publicKey);
  expect(t.service.deviceId()).toBe('dev-new');
  expect(t.stored()?.deviceId).toBe('dev-new');
});

it('removed: clears the id, calls onRemoved once and does not register', async () => {
  const t = setup(registered());
  t.current.mockImplementationOnce(async () => fail('removed'));
  await t.service.sync();
  expect(t.onRemoved).toHaveBeenCalledTimes(1);
  expect(t.register).not.toHaveBeenCalled();
  expect(t.service.deviceId()).toBeNull();
  expect(t.stored()).toEqual({ v: 1, ...pair(1) });
});

it('keyRemoved: rotates the key pair and retries exactly once', async () => {
  const t = setup();
  t.register.mockImplementationOnce(async () => fail('keyRemoved'));
  await t.service.sync();
  expect(t.register).toHaveBeenCalledTimes(2);
  expect(t.register.mock.calls[1]![0].publicKey).toBe(pair(2).publicKey);
  expect(t.register.mock.calls[1]![1]).toBe('key-2');
  expect(t.stored()).toEqual({ v: 1, ...pair(2), deviceId: 'dev-1' });
});

it('keyRemoved twice stops', async () => {
  const t = setup();
  t.register.mockImplementation(async () => fail('keyRemoved'));
  await t.service.sync();
  expect(t.register).toHaveBeenCalledTimes(2);
  expect(t.service.deviceId()).toBeNull();
});

it.each(['network', 'other'] as const)('%s while checking keeps everything', async (kind) => {
  const t = setup(registered());
  t.current.mockImplementationOnce(async () => fail(kind));
  await t.service.sync();
  expect(t.service.deviceId()).toBe('dev-1');
  expect(t.stored()).toEqual(registered());
  expect(t.onRemoved).not.toHaveBeenCalled();
  expect(t.register).not.toHaveBeenCalled();
});

it('network while registering keeps the key pair and the idempotency key', async () => {
  const t = setup();
  t.register.mockImplementationOnce(async () => fail('network'));
  await t.service.sync();
  expect(t.service.deviceId()).toBeNull();
  expect(t.stored()).toEqual({ v: 1, ...pair(1), idempotencyKey: 'key-1' });
});

it('a crash after saving the idempotency key reuses it on the next sync', async () => {
  const t = setup({ v: 1, ...pair(1), idempotencyKey: 'key-crash' });
  await t.service.sync();
  expect(t.register.mock.calls[0]![1]).toBe('key-crash');
});

it('concurrent syncs share one run', async () => {
  const t = setup();
  await Promise.all([t.service.sync(), t.service.sync(), t.service.sync()]);
  expect(t.register).toHaveBeenCalledTimes(1);
});

it('forget clears the id but keeps the key pair', async () => {
  const t = setup();
  await t.service.sync();
  await t.service.forget();
  expect(t.service.deviceId()).toBeNull();
  expect(t.stored()).toEqual({ v: 1, ...pair(1) });
  await t.service.sync();
  expect(t.register.mock.calls[1]![0].publicKey).toBe(pair(1).publicKey);
});

it('a registration that finishes after forget does not keep its id', async () => {
  const t = setup();
  let release: () => void = () => undefined;
  t.register.mockImplementationOnce(
    () => new Promise((resolve) => (release = () => resolve(linked('dev-1')))),
  );
  const run = t.service.sync();
  await new Promise((r) => setTimeout(r, 0));
  await t.service.forget();
  release();
  await run;
  expect(t.service.deviceId()).toBeNull();
  expect(t.stored()?.deviceId).toBeUndefined();
});

it('a sync that reads the Keychain during a sign out keeps no id', async () => {
  const t = setup(registered('dev-1'));
  const run = t.service.sync();
  await t.service.forget();
  await run;
  expect(t.service.deviceId()).toBeNull();
  expect(t.current).not.toHaveBeenCalled();
  expect(t.stored()?.deviceId).toBeUndefined();
});

describe('current', () => {
  it('asks the API about the stored device and returns its id and status', async () => {
    const t = setup(registered('dev-9'));
    t.current.mockResolvedValueOnce({ ...linked('dev-9'), status: 'pending' });
    expect(await t.service.current()).toEqual({ id: 'dev-9', status: 'pending' });
    expect(t.current).toHaveBeenCalledWith('dev-9');
  });

  it('is null without a registered device and does not call the API', async () => {
    const none = setup();
    expect(await none.service.current()).toBeNull();
    const keysOnly = setup({ v: 1, ...pair(1) });
    expect(await keysOnly.service.current()).toBeNull();
    expect(none.current).not.toHaveBeenCalled();
    expect(keysOnly.current).not.toHaveBeenCalled();
  });

  it('is null when the API does not know the device, and keeps the stored id for sync', async () => {
    const t = setup(registered());
    t.current.mockImplementationOnce(async () => fail('notFound'));
    expect(await t.service.current()).toBeNull();
    expect(t.stored()).toEqual(registered());
    expect(t.onRemoved).not.toHaveBeenCalled();
  });

  it('removed: clears the id, calls onRemoved once and answers null', async () => {
    const t = setup(registered());
    t.current.mockImplementationOnce(async () => fail('removed'));
    expect(await t.service.current()).toBeNull();
    expect(t.onRemoved).toHaveBeenCalledTimes(1);
    expect(t.service.deviceId()).toBeNull();
    expect(t.stored()).toEqual({ v: 1, ...pair(1) });
  });

  it.each(['network', 'other'] as const)('%s throws and keeps everything', async (kind) => {
    const t = setup(registered());
    t.current.mockImplementationOnce(async () => fail(kind));
    await expect(t.service.current()).rejects.toMatchObject({ kind });
    expect(t.stored()).toEqual(registered());
    expect(t.onRemoved).not.toHaveBeenCalled();
  });
});

describe('publicKey', () => {
  it('returns the stored public key as bytes, or null before there is a key pair', async () => {
    expect(await setup(registered()).service.publicKey()).toEqual(new Uint8Array(32).fill(101));
    expect(await setup().service.publicKey()).toBeNull();
  });
});

describe('sharedSecret', () => {
  // RFC 7748 section 6.1: Alice holds the stored key pair, Bob is the peer.
  const alice: DeviceRecord = {
    v: 1,
    privateKey: toBase64(hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a')),
    publicKey: toBase64(hex('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a')),
  };
  const bobPublic = hex('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
  const shared = hex('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');

  it('is the X25519 secret of the stored private key and the peer key', async () => {
    const t = setup(alice);
    expect(await t.service.sharedSecret(bobPublic)).toEqual(shared);
    expect(fromBase64(alice.publicKey)).toHaveLength(32);
  });

  it.each([0, 31, 33, 64])('rejects a peer key of %i bytes', async (length) => {
    const t = setup(alice);
    await expect(t.service.sharedSecret(new Uint8Array(length))).rejects.toThrow();
  });

  it('throws when there is no key pair', async () => {
    await expect(setup().service.sharedSecret(bobPublic)).rejects.toThrow();
  });
});
