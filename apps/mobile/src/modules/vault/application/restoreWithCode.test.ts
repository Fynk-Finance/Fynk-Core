// Restore with the recovery code: every outcome, in order, with fakes for the ports.
import { deriveDeviceProof } from '../domain/crypto';
import { encodeRecoveryCode, formatRecoveryCode } from '../domain/recoveryCode';
import { wrapDek } from '../domain/recoveryKey';
import { RecoveryError, type RecoveryKdf, type StoredRecoveryKey } from './ports';
import { createRestoreWithCode } from './restoreWithCode';

const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 50);
const SALT = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
const NONCE = Uint8Array.from({ length: 12 }, (_, i) => i + 100);
const CODE = encodeRecoveryCode(Uint8Array.from({ length: 16 }, (_, i) => i * 7));
const OTHER_CODE = encodeRecoveryCode(Uint8Array.from({ length: 16 }, (_, i) => i * 11));

/** A cheap fake KDF: the key depends on the code and the salt. */
const kdf: RecoveryKdf = async (code, salt) =>
  Uint8Array.from(
    { length: 32 },
    (_, i) => (code.charCodeAt(i % code.length) + (salt[i % 16] ?? 0)) & 255,
  );

async function storedKey(): Promise<StoredRecoveryKey> {
  return {
    wrappedDek: wrapDek(await kdf(CODE, SALT), NONCE, DEK),
    nonce: NONCE,
    salt: SALT,
    kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
    createdAt: '2026-10-30T10:00:00Z',
  };
}

async function setup(
  options: {
    key?: StoredRecoveryKey | null;
    getError?: Error;
    activateError?: Error;
    restoreError?: Error;
    openError?: Error;
    pending?: boolean;
  } = {},
) {
  const calls: string[] = [];
  const key = options.key === undefined ? await storedKey() : options.key;
  const written: Uint8Array[] = [];
  const proofs: Uint8Array[] = [];
  const opened: Uint8Array[] = [];
  let pending = options.pending ?? false;
  const deps = {
    recoveryKey: {
      get: jest.fn(async () => {
        calls.push('get');
        if (options.getError) throw options.getError;
        return key;
      }),
      activate: jest.fn(async (proof: Uint8Array) => {
        proofs.push(proof.slice());
        calls.push('activate');
        if (options.activateError) throw options.activateError;
      }),
    },
    kdf: jest.fn(kdf),
    dekStore: {
      write: jest.fn(async (dek: Uint8Array) => {
        calls.push('write');
        // The caller wipes its copy afterwards, so keep ours.
        written.push(dek.slice());
      }),
      remove: jest.fn(async () => {
        calls.push('remove');
      }),
    },
    vault: {
      wipe: jest.fn(async () => {
        calls.push('wipe');
      }),
      open: jest.fn(async (dek: Uint8Array) => {
        opened.push(dek.slice());
        calls.push('open');
        if (options.openError) throw options.openError;
      }),
      close: jest.fn(async () => {
        calls.push('close');
      }),
    },
    restoreState: {
      mark: jest.fn(async () => {
        calls.push('mark');
        pending = true;
      }),
      clear: jest.fn(async () => {
        calls.push('clear');
        pending = false;
      }),
      isPending: jest.fn(async () => pending),
    },
    restoreAll: jest.fn(async () => {
      calls.push('restoreAll');
      if (options.restoreError) throw options.restoreError;
      return { imported: 3, skipped: 0 };
    }),
  };
  return {
    service: createRestoreWithCode(deps),
    deps,
    calls,
    written,
    proofs,
    opened,
    isPending: () => pending,
  };
}

describe('restore', () => {
  it('activates first, then writes copy A, opens, marks, restores and clears the mark', async () => {
    const t = await setup();
    expect(await t.service.restore(CODE)).toBe('restored');
    expect(t.calls).toEqual([
      'get',
      'activate',
      'wipe',
      'write',
      'open',
      'mark',
      'restoreAll',
      'clear',
    ]);
    expect(t.proofs).toEqual([deriveDeviceProof(DEK)]);
    expect(t.written).toEqual([DEK]);
    expect(t.opened).toEqual([DEK]);
    expect(t.isPending()).toBe(false);
  });

  it('accepts groups, lowercase and the I, L, O slips', async () => {
    const t = await setup();
    const typed = formatRecoveryCode(CODE).toLowerCase().replace(/1/g, 'l').replace(/0/g, 'o');
    expect(await t.service.restore(typed)).toBe('restored');
    expect(t.deps.kdf.mock.calls[0]![0]).toBe(CODE);
  });

  it('wipes the key bytes it handled once it is done', async () => {
    const t = await setup();
    await t.service.restore(CODE);
    // The DEK passed to open is zeroed after the restore: the vault keeps its own copy.
    expect(t.deps.vault.open.mock.calls[0]![0]).toEqual(new Uint8Array(32));
    expect(t.deps.recoveryKey.activate.mock.calls[0]![0]).toEqual(new Uint8Array(32));
  });

  it('is invalid without any network call when the text is not a code', async () => {
    const t = await setup();
    for (const typed of ['', 'ABC', `${CODE}A`, 'U'.repeat(26)]) {
      expect(await t.service.restore(typed)).toBe('invalid');
    }
    expect(t.calls).toEqual([]);
  });

  it('says noBackup when the account has no recovery key', async () => {
    const t = await setup({ key: null });
    expect(await t.service.restore(CODE)).toBe('noBackup');
    expect(t.calls).toEqual(['get']);
  });

  it('maps a failed read of the recovery key', async () => {
    expect(
      await (await setup({ getError: new RecoveryError('offline') })).service.restore(CODE),
    ).toBe('offline');
    expect(await (await setup({ getError: new Error('boom') })).service.restore(CODE)).toBe(
      'failed',
    );
  });

  it('decides a wrong code on the phone: the server hears nothing and nothing is stored', async () => {
    const t = await setup();
    expect(await t.service.restore(OTHER_CODE)).toBe('wrongCode');
    expect(t.calls).toEqual(['get']);
    expect(t.deps.recoveryKey.activate).not.toHaveBeenCalled();
  });

  it.each([
    ['mismatch', 'wrongCode'],
    ['tooMany', 'tooMany'],
    ['removed', 'removed'],
    ['noKey', 'noBackup'],
    ['offline', 'offline'],
    ['unknown', 'failed'],
    ['notActive', 'failed'],
  ] as const)('maps the activation error %s to %s and stores nothing', async (kind, result) => {
    const t = await setup({ activateError: new RecoveryError(kind) });
    expect(await t.service.restore(CODE)).toBe(result);
    expect(t.calls).toEqual(['get', 'activate']);
  });

  it('keeps the vault open and the mark on when the download fails (offline)', async () => {
    const t = await setup({ restoreError: new Error('offline') });
    expect(await t.service.restore(CODE)).toBe('partial');
    expect(t.calls).toEqual(['get', 'activate', 'wipe', 'write', 'open', 'mark', 'restoreAll']);
    expect(t.isPending()).toBe(true);
    expect(t.deps.vault.close).not.toHaveBeenCalled();
  });

  it('goes back to a phone without a key when the vault cannot open', async () => {
    const t = await setup({ openError: new Error('corrupt') });
    expect(await t.service.restore(CODE)).toBe('failed');
    expect(t.calls.slice(-2)).toEqual(['close', 'remove']);
    expect(t.deps.restoreAll).not.toHaveBeenCalled();
  });

  it('a pending phone never reads records nor opens the vault without the right code', async () => {
    const wrong = await setup();
    await wrong.service.restore(OTHER_CODE);
    await wrong.service.restore('nope');
    const denied = await setup({ activateError: new RecoveryError('tooMany') });
    await denied.service.restore(CODE);
    for (const t of [wrong, denied]) {
      expect(t.deps.restoreAll).not.toHaveBeenCalled();
      expect(t.deps.vault.open).not.toHaveBeenCalled();
      expect(t.deps.dekStore.write).not.toHaveBeenCalled();
    }
  });
});

describe('resumePending', () => {
  it('does nothing when no restore is pending', async () => {
    const t = await setup();
    await t.service.resumePending();
    expect(t.deps.restoreAll).not.toHaveBeenCalled();
  });

  it('restores again and clears the mark', async () => {
    const t = await setup({ pending: true });
    await t.service.resumePending();
    expect(t.calls).toEqual(['restoreAll', 'clear']);
    expect(t.isPending()).toBe(false);
  });

  it('keeps the mark and does not throw when the download fails again', async () => {
    const t = await setup({ pending: true, restoreError: new Error('offline') });
    await expect(t.service.resumePending()).resolves.toBeUndefined();
    expect(t.isPending()).toBe(true);
  });
});
