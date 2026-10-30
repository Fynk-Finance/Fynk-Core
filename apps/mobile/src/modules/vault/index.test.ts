// identity imports the vault (wipe) and the vault imports identity (session, device). Either
// module index loads first without throwing, because neither calls the other while loading.
jest.mock('react-native-app-auth', () => ({ authorize: jest.fn(), refresh: jest.fn() }));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x', AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'y' },
  hasGenericPassword: jest.fn(async () => false),
  getSupportedBiometryType: jest.fn(async () => null),
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => ({ service: 's', storage: 'keychain' })),
  resetGenericPassword: jest.fn(async () => true),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(1)),
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('react-native-argon2', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }), { virtual: true });

type Identity = typeof import('@modules/identity');
type VaultModule = typeof import('./index');

function loadBoth(first: 'identity' | 'vault'): { identity: Identity; vault: VaultModule } {
  let identity!: Identity;
  let vault!: VaultModule;
  jest.isolateModules(() => {
    if (first === 'identity') {
      identity = jest.requireActual<Identity>('@modules/identity');
      vault = jest.requireActual<VaultModule>('./index');
    } else {
      vault = jest.requireActual<VaultModule>('./index');
      identity = jest.requireActual<Identity>('@modules/identity');
    }
  });
  return { identity, vault };
}

it.each(['identity', 'vault'] as const)('loads both module indexes, %s first', (first) => {
  const { identity, vault } = loadBoth(first);
  expect(typeof identity.useSession).toBe('function');
  expect(typeof identity.routes.useGate).toBe('function');
  expect(typeof vault.routes.useGate).toBe('function');
  expect(vault.routes.flow).toBeDefined();
  expect(typeof vault.wipe).toBe('function');
});

it('registers the new recovery code screen and exports the Seguridad rows', () => {
  const { vault } = loadBoth('vault');
  expect(vault.routes.screens?.map((s) => [s.name, s.path, s.transition])).toEqual([
    ['vault.RecoveryCode', 'boveda/recuperacion', undefined],
  ]);
  expect(typeof vault.UnlockSetting).toBe('function');
  expect(typeof vault.RecoveryCodeRow).toBe('function');
});

describe('backup port', () => {
  const collection = {
    module: 'savings' as const,
    collection: 'savings.goals',
    exportAll: async () => [],
    importAll: async () => undefined,
  };

  it('exports the registry, markDirty and exportAll, but not restoreAll', () => {
    const { vault } = loadBoth('vault');
    expect(typeof vault.registerBackupCollection).toBe('function');
    expect(typeof vault.markDirty).toBe('function');
    expect(typeof vault.exportAll).toBe('function');
    expect(Object.keys(vault)).not.toContain('restoreAll');
  });

  it('registers a collection, accepts marks while locked and exports it', async () => {
    const { vault } = loadBoth('vault');
    expect(() => vault.markDirty('savings.goals', 'g1')).toThrow(/not registered/);
    vault.registerBackupCollection(collection);
    expect(() => vault.registerBackupCollection(collection)).toThrow(/already registered/);
    expect(() => vault.markDirty('savings.goals', 'g1')).not.toThrow();
    expect(await vault.exportAll()).toEqual({ 'savings.goals': [] });
  });

  it('keeps the registered collections after a wipe', async () => {
    const { vault } = loadBoth('vault');
    vault.registerBackupCollection(collection);
    await vault.wipe().catch(() => undefined);
    expect(await vault.exportAll()).toEqual({ 'savings.goals': [] });
  });
});
