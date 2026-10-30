import type { BiometricRead, DekStore } from '../application/ports';
import { createConfirmOwner } from './confirmOwner';

const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const prompt = { title: 'Aprueba el nuevo dispositivo', subtitle: 's', cancel: 'c' };

function setup(
  options: {
    available?: boolean;
    copyB?: boolean;
    bio?: BiometricRead;
    reauth?: 'ok' | 'cancelled' | 'failed';
    copyA?: Uint8Array | null;
  } = {},
) {
  const dekStore = {
    read: jest.fn(async () => (options.copyA === undefined ? DEK : options.copyA)),
    biometricsAvailable: jest.fn(async () => options.available ?? true),
    hasBiometric: jest.fn(async () => options.copyB ?? true),
    readBiometric: jest.fn(
      async (): Promise<BiometricRead> => options.bio ?? { status: 'ok', dek: DEK },
    ),
    removeBiometric: jest.fn(async () => undefined),
  };
  const reauthenticate = jest.fn(async () => options.reauth ?? 'ok');
  const confirm = createConfirmOwner({
    dekStore: dekStore as unknown as DekStore,
    reauthenticate,
    biometricPrompt: prompt,
  });
  return { confirm, dekStore, reauthenticate };
}

describe('with biometrics on', () => {
  it('returns the DEK of copy B behind the prompt and never asks for the password', async () => {
    const { confirm, dekStore, reauthenticate } = setup();
    expect(await confirm()).toEqual(DEK);
    expect(dekStore.readBiometric).toHaveBeenCalledWith(prompt);
    expect(reauthenticate).not.toHaveBeenCalled();
    expect(dekStore.read).not.toHaveBeenCalled();
  });

  it('returns null when the person cancels the prompt', async () => {
    const { confirm, reauthenticate } = setup({ bio: { status: 'cancelled' } });
    expect(await confirm()).toBeNull();
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it.each(['invalidated', 'failed'] as const)(
    'falls back to the password when biometrics are %s',
    async (status) => {
      const { confirm, reauthenticate, dekStore } = setup({ bio: { status } });
      expect(await confirm()).toEqual(DEK);
      expect(reauthenticate).toHaveBeenCalledTimes(1);
      expect(dekStore.read).toHaveBeenCalledTimes(1);
    },
  );
});

describe('with the password', () => {
  it.each([
    ['no copy B', { copyB: false }],
    ['no biometrics on the phone', { available: false }],
  ])('asks for it when there is %s, even if the vault is open', async (_name, options) => {
    const { confirm, reauthenticate, dekStore } = setup(options);
    expect(await confirm()).toEqual(DEK);
    expect(reauthenticate).toHaveBeenCalledTimes(1);
    expect(dekStore.readBiometric).not.toHaveBeenCalled();
  });

  it('returns null when the person cancels the login', async () => {
    const { confirm, dekStore } = setup({ copyB: false, reauth: 'cancelled' });
    expect(await confirm()).toBeNull();
    expect(dekStore.read).not.toHaveBeenCalled();
  });

  it('throws when the login fails, and when the phone has no key', async () => {
    await expect(setup({ copyB: false, reauth: 'failed' }).confirm()).rejects.toThrow();
    await expect(setup({ copyB: false, copyA: null }).confirm()).rejects.toThrow();
  });
});
