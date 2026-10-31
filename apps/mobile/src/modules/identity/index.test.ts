// What the identity module offers the vault (M2): only functions and values, never tokens or keys.
jest.mock('react-native-app-auth', () => ({ authorize: jest.fn(), refresh: jest.fn() }));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x', AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'y' },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => ({ service: 's', storage: 'keychain' })),
  resetGenericPassword: jest.fn(async () => true),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(1)),
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));

type Identity = typeof import('./index');

function load(devAuth: string | undefined): Identity {
  const previous = process.env.EXPO_PUBLIC_DEV_AUTH;
  if (devAuth === undefined) delete process.env.EXPO_PUBLIC_DEV_AUTH;
  else process.env.EXPO_PUBLIC_DEV_AUTH = devAuth;
  try {
    let identity!: Identity;
    jest.isolateModules(() => {
      identity = jest.requireActual<Identity>('./index');
    });
    return identity;
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_DEV_AUTH;
    else process.env.EXPO_PUBLIC_DEV_AUTH = previous;
  }
}

it('exports the functions the vault needs', () => {
  const identity = load(undefined);
  for (const name of [
    'lastLoginAt',
    'onSessionChange',
    'reauthenticate',
    'currentDevice',
    'devicePublicKey',
    'deviceSharedSecret',
    'backupEnabled',
  ] as const) {
    expect(typeof identity[name]).toBe('function');
  }
  // Nothing hands out tokens or the private key.
  expect(Object.keys(identity)).not.toEqual(
    expect.arrayContaining(['devicePrivateKey', 'getTokens', 'getIdToken']),
  );
});

describe('with a real session and no registered device', () => {
  it('has no last login while nobody is signed in', () => {
    expect(load(undefined).lastLoginAt()).toBeNull();
  });

  it('answers null for the device and its public key, and refuses a shared secret', async () => {
    const identity = load(undefined);
    expect(await identity.currentDevice()).toBeNull();
    expect(await identity.devicePublicKey()).toBeNull();
    await expect(identity.deviceSharedSecret(new Uint8Array(32).fill(9))).rejects.toThrow();
  });

  it('has a backup to protect', () => {
    expect(load(undefined).backupEnabled()).toBe(true);
  });

  it('does not reauthenticate when signed out', async () => {
    expect(await load(undefined).reauthenticate()).toBe('cancelled');
  });
});

describe('onSessionChange', () => {
  it('passes the new state to the listener until it unsubscribes', async () => {
    const identity = load(undefined);
    const listener = jest.fn();
    const unsubscribe = identity.onSessionChange(listener);
    await identity.signOut(); // signed out: the state changes
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'signedOut' }));
    unsubscribe();
    listener.mockClear();
    await identity.signOut();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('with the dev session (EXPO_PUBLIC_DEV_AUTH)', () => {
  it('counts as just logged in, reauthenticates with ok and has an active phone without keys', async () => {
    const identity = load('dev-token');
    const before = Date.now();
    const at = identity.lastLoginAt();
    expect(at).toBeInstanceOf(Date);
    expect(at!.getTime()).toBeGreaterThanOrEqual(before);
    expect(await identity.reauthenticate()).toBe('ok');
    // No API in the dev session: the vault treats its phone as the account's first.
    expect(await identity.currentDevice()).toEqual({ id: 'dev', status: 'active' });
    // No registered device and no API: no backup, so no recovery code.
    expect(identity.backupEnabled()).toBe(false);
    expect(await identity.devicePublicKey()).toBeNull();
    await expect(identity.deviceSharedSecret(new Uint8Array(32))).rejects.toThrow();
  });

  it('has no last login after sign out', async () => {
    const identity = load('dev-token');
    await identity.signOut();
    expect(identity.lastLoginAt()).toBeNull();
  });
});
