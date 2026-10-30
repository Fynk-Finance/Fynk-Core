// Restore on a new phone with the old phone's approval: every outcome, with fakes for the ports.
// The round trip uses the real old phone service (ephemeral X25519 key, HKDF, AES-GCM).
import { x25519 } from '@noble/curves/ed25519.js';

import { approvalCode } from '../domain/crypto';
import { createApproveDeviceService, type KeyAgreementPort } from './approveDevice';
import {
  ApprovalError,
  type ApprovalGrant,
  type ApprovalState,
  type ApprovalStatus,
  type DeviceApprovalsApiPort,
  type PendingApproval,
} from './ports';
import { createRestoreWithApproval } from './restoreWithApproval';

const ID = '0F9C1B1E-7D5A-4C3E-9A52-3B1F5D8E2A10';
const EXPIRES = '2026-10-30T10:10:00Z';
const DEK = Uint8Array.from({ length: 32 }, (_, i) => i + 50);
const NEW_PRIVATE = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const NEW_PUBLIC = x25519.getPublicKey(NEW_PRIVATE);
const EPHEMERAL_PRIVATE = Uint8Array.from({ length: 32 }, (_, i) => i + 90);

/** The old phone seals the DEK for the new phone's key; returns what the server would hand over. */
async function sealedGrant(approvalId = ID): Promise<ApprovalGrant> {
  let stored: ApprovalGrant | undefined;
  const keys: KeyAgreementPort = {
    generate: () => ({
      privateKey: EPHEMERAL_PRIVATE,
      publicKey: x25519.getPublicKey(EPHEMERAL_PRIVATE),
    }),
    sharedSecret: (priv, peer) => x25519.getSharedSecret(priv, peer),
  };
  const oldPhone = createApproveDeviceService({
    api: {
      listPending: async () => [],
      reject: async () => {
        throw new Error('unused');
      },
      approve: async (_id, grant) => {
        stored = grant;
        return { id: approvalId, status: 'approved', createdAt: EXPIRES, expiresAt: EXPIRES };
      },
    },
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => i + 200),
    keys,
    confirmOwner: async () => DEK.slice(),
  });
  const request: PendingApproval = {
    id: approvalId,
    deviceName: 'Pixel',
    platform: 'android',
    newDevicePublicKey: NEW_PUBLIC,
    createdAt: EXPIRES,
    expiresAt: EXPIRES,
  };
  expect(await oldPhone.approve(request)).toBe('approved');
  return stored!;
}

interface Options {
  status?: ApprovalStatus;
  grant?: ApprovalGrant;
  createError?: Error;
  getError?: Error;
  publicKey?: Uint8Array | null;
  sharedSecretError?: Error;
  completeResult?: 'restored' | 'partial' | 'failed';
}

function setup(options: Options = {}) {
  const create = jest.fn(async (_key: string) => {
    if (options.createError) throw options.createError;
    return { id: ID, status: 'pending' as const, createdAt: EXPIRES, expiresAt: EXPIRES };
  });
  const get = jest.fn(async (_id: string): Promise<ApprovalState> => {
    if (options.getError) throw options.getError;
    return {
      id: ID,
      status: options.status ?? 'pending',
      expiresAt: EXPIRES,
      grant: options.grant,
    };
  });
  const sharedSecrets: Uint8Array[] = [];
  const deks: Uint8Array[] = [];
  const completeRestore = jest.fn(async (dek: Uint8Array) => {
    // The service zeroes its copy afterwards, so keep ours.
    deks.push(dek.slice());
    return options.completeResult ?? 'restored';
  });
  let draws = 0;
  const randomBytes = jest.fn((n: number) => {
    draws += 1;
    return Uint8Array.from({ length: n }, (_, i) => i + draws);
  });
  const service = createRestoreWithApproval({
    api: { create, get } satisfies Pick<DeviceApprovalsApiPort, 'create' | 'get'>,
    randomBytes,
    devicePublicKey: async () => (options.publicKey === undefined ? NEW_PUBLIC : options.publicKey),
    deviceSharedSecret: async (peer) => {
      if (options.sharedSecretError) throw options.sharedSecretError;
      const shared = x25519.getSharedSecret(NEW_PRIVATE, peer);
      sharedSecrets.push(shared);
      return shared;
    },
    completeRestore,
  });
  return { service, create, get, completeRestore, sharedSecrets, deks, randomBytes };
}

describe('start', () => {
  it('asks with a random idempotency key and returns the code of the public key', async () => {
    const t = setup();
    const started = await t.service.start();
    expect(started).toEqual({
      status: 'started',
      id: ID,
      code: approvalCode(NEW_PUBLIC),
      expiresAt: EXPIRES,
    });
    expect(t.create).toHaveBeenCalledTimes(1);
    expect(t.create.mock.calls[0]![0]).toMatch(/^[0-9a-f]{32}$/);
  });

  it('uses a new key every time, so "Pedir de nuevo" is a new request', async () => {
    const t = setup();
    await t.service.start();
    await t.service.start();
    expect(t.create.mock.calls[0]![0]).not.toBe(t.create.mock.calls[1]![0]);
  });

  it.each([
    ['device_already_active', new ApprovalError('alreadyActive'), 'alreadyActive'],
    ['a lost connection', new ApprovalError('offline'), 'offline'],
    ['another problem', new ApprovalError('unknown'), 'failed'],
    ['an unexpected error', new Error('boom'), 'failed'],
  ] as const)('maps %s to %s', async (_name, createError, status) => {
    const t = setup({ createError });
    expect(await t.service.start()).toEqual({ status });
  });

  it('fails without asking when the phone has no key pair', async () => {
    const t = setup({ publicKey: null });
    expect(await t.service.start()).toEqual({ status: 'failed' });
    expect(t.create).not.toHaveBeenCalled();
  });
});

describe('check', () => {
  it('keeps waiting while the request is pending', async () => {
    const t = setup({ status: 'pending' });
    expect(await t.service.check(ID)).toBe('waiting');
    expect(t.completeRestore).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'expired'] as const)('reports %s', async (status) => {
    const t = setup({ status });
    expect(await t.service.check(ID)).toBe(status);
    expect(t.completeRestore).not.toHaveBeenCalled();
  });

  it('opens the grant of the old phone, restores with that DEK and zeroes the secrets', async () => {
    const t = setup({ status: 'approved', grant: await sealedGrant() });
    const restoring = jest.fn();
    expect(await t.service.check(ID, restoring)).toBe('restored');
    expect(t.deks).toEqual([DEK]);
    expect(restoring).toHaveBeenCalledTimes(1);
    expect(restoring.mock.invocationCallOrder[0]).toBeLessThan(
      t.completeRestore.mock.invocationCallOrder[0]!,
    );
    expect(t.sharedSecrets[0]!.every((b) => b === 0)).toBe(true);
    // The DEK handed to the restore is wiped once it returns.
    expect(t.completeRestore.mock.calls[0]![0].every((b) => b === 0)).toBe(true);
  });

  it('passes on partial and failed restores', async () => {
    for (const completeResult of ['partial', 'failed'] as const) {
      const t = setup({ status: 'approved', grant: await sealedGrant(), completeResult });
      expect(await t.service.check(ID)).toBe(completeResult);
    }
  });

  it('is failed when the grant was sealed for another request (AAD)', async () => {
    const t = setup({
      status: 'approved',
      grant: await sealedGrant('11111111-2222-4333-8444-555555555555'),
    });
    expect(await t.service.check(ID)).toBe('failed');
    expect(t.completeRestore).not.toHaveBeenCalled();
    expect(t.sharedSecrets[0]!.every((b) => b === 0)).toBe(true);
  });

  it('is failed when a byte of the grant was changed', async () => {
    const grant = await sealedGrant();
    grant.wrappedDek[3] = (grant.wrappedDek[3]! + 1) & 255;
    const t = setup({ status: 'approved', grant });
    expect(await t.service.check(ID)).toBe('failed');
    expect(t.completeRestore).not.toHaveBeenCalled();
  });

  it('announces the restore as soon as a grant arrives, even when it cannot be opened', async () => {
    const grant = await sealedGrant();
    grant.nonce[0] = (grant.nonce[0]! + 1) & 255;
    const t = setup({ status: 'approved', grant });
    const restoring = jest.fn();
    expect(await t.service.check(ID, restoring)).toBe('failed');
    expect(restoring).toHaveBeenCalledTimes(1);
    const waiting = jest.fn();
    await setup({ status: 'pending' }).service.check(ID, waiting);
    expect(waiting).not.toHaveBeenCalled();
  });

  it('is failed when the shared secret cannot be made', async () => {
    const t = setup({
      status: 'approved',
      grant: await sealedGrant(),
      sharedSecretError: new Error('no key'),
    });
    expect(await t.service.check(ID)).toBe('failed');
    expect(t.completeRestore).not.toHaveBeenCalled();
  });

  it('is grantLost when the request is approved but the grant was already read', async () => {
    const t = setup({ status: 'approved' });
    expect(await t.service.check(ID)).toBe('grantLost');
    expect(t.completeRestore).not.toHaveBeenCalled();
  });

  it.each([
    [new ApprovalError('offline'), 'offline'],
    [new ApprovalError('expired'), 'expired'],
    [new ApprovalError('notFound'), 'failed'],
    [new ApprovalError('unknown'), 'failed'],
    [new Error('boom'), 'failed'],
  ] as const)('maps the error %# to %s', async (getError, result) => {
    const t = setup({ getError });
    expect(await t.service.check(ID)).toBe(result);
  });
});
