import { x25519 } from '@noble/curves/ed25519.js';

import { approvalCode } from '../domain/crypto';
import { openGrant } from '../domain/deviceApproval';
import { createApproveDeviceService, type KeyAgreementPort } from './approveDevice';
import {
  ApprovalError,
  type ApprovalGrant,
  type ApprovalErrorKind,
  type PendingApproval,
} from './ports';

const bytes = (length: number, start = 0) => Uint8Array.from({ length }, (_, i) => start + i);
const DEK_SOURCE = bytes(32, 100);
const NEW_PRIVATE = bytes(32, 1);
const EPHEMERAL_PRIVATE_SOURCE = bytes(32, 50);
const ID = '4a6e8c10-2b3d-4f5a-8c7e-9d1b3f5a7c20';

const request: PendingApproval = {
  id: ID,
  deviceName: 'Pixel de Camila',
  platform: 'android',
  newDevicePublicKey: x25519.getPublicKey(NEW_PRIVATE),
  createdAt: 'a',
  expiresAt: 'b',
};

function setup(
  options: {
    owner?: 'ok' | 'cancel' | Error;
    approve?: ApprovalErrorKind | 'ok' | Error;
    reject?: ApprovalErrorKind | 'ok';
  } = {},
) {
  // The service wipes what it holds, so each call gets its own copies.
  const dek = bytes(32, 100);
  const ephemeralPrivate = bytes(32, 50);
  let granted: ApprovalGrant | null = null;
  const seen: { dek: Uint8Array; shared: Uint8Array[]; ephemeralPrivate: Uint8Array } = {
    dek,
    shared: [],
    ephemeralPrivate,
  };
  const keys: KeyAgreementPort = {
    generate: () => ({
      privateKey: ephemeralPrivate,
      publicKey: x25519.getPublicKey(EPHEMERAL_PRIVATE_SOURCE),
    }),
    sharedSecret: (priv, peer) => {
      const shared = x25519.getSharedSecret(priv, peer);
      seen.shared.push(shared);
      return shared;
    },
  };
  const api = {
    listPending: jest.fn(async () => [request]),
    approve: jest.fn(async (_id: string, grant: ApprovalGrant) => {
      const result = options.approve ?? 'ok';
      if (result instanceof Error) throw result;
      if (result !== 'ok') throw new ApprovalError(result);
      granted = grant;
      return { id: ID, status: 'approved' as const, createdAt: 'a', expiresAt: 'b' };
    }),
    reject: jest.fn(async () => {
      const result = options.reject ?? 'ok';
      if (result !== 'ok') throw new ApprovalError(result);
      return { id: ID, status: 'rejected' as const, createdAt: 'a', expiresAt: 'b' };
    }),
  };
  const confirmOwner = jest.fn(async () => {
    if (options.owner instanceof Error) throw options.owner;
    return options.owner === 'cancel' ? null : dek;
  });
  const randomBytes = jest.fn((n: number) => bytes(n, 7));
  const service = createApproveDeviceService({ api, randomBytes, keys, confirmOwner });
  return { service, api, confirmOwner, randomBytes, seen, granted: () => granted };
}

describe('listPending', () => {
  it('adds the 6 digit code of each new device key', async () => {
    const { service } = setup();
    const list = await service.listPending();
    expect(list).toHaveLength(1);
    expect(list[0]!.code).toBe(approvalCode(request.newDevicePublicKey));
    expect(list[0]!.deviceName).toBe('Pixel de Camila');
  });

  it('passes an API failure on', async () => {
    const { service, api } = setup();
    api.listPending.mockRejectedValueOnce(new ApprovalError('offline'));
    await expect(service.listPending()).rejects.toMatchObject({ kind: 'offline' });
  });
});

describe('approve', () => {
  it('seals the DEK so only the new phone opens it, then wipes every secret', async () => {
    const { service, api, seen, granted, confirmOwner } = setup();
    expect(await service.approve(request)).toBe('approved');
    expect(confirmOwner).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith(ID, expect.anything());

    const grant = granted()!;
    expect(grant.wrappedDek).toHaveLength(48);
    expect(grant.nonce).toEqual(bytes(12, 7));
    // The new phone's side of the exchange.
    const shared = x25519.getSharedSecret(NEW_PRIVATE, grant.ephemeralPublicKey);
    expect(
      openGrant({
        shared,
        nonce: grant.nonce,
        wrappedDek: grant.wrappedDek,
        approvalId: ID,
      }),
    ).toEqual(DEK_SOURCE);

    expect(seen.dek).toEqual(new Uint8Array(32));
    expect(seen.ephemeralPrivate).toEqual(new Uint8Array(32));
    expect(seen.shared[0]).toEqual(new Uint8Array(32));
  });

  it('does nothing when the person cancels', async () => {
    const { service, api, seen } = setup({ owner: 'cancel' });
    expect(await service.approve(request)).toBe('cancelled');
    expect(api.approve).not.toHaveBeenCalled();
    expect(seen.shared).toHaveLength(0);
  });

  it('returns failed when the check fails, and sends nothing', async () => {
    const { service, api } = setup({ owner: new Error('password check failed') });
    expect(await service.approve(request)).toBe('failed');
    expect(api.approve).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', 'expired'],
    ['notPending', 'notPending'],
    ['notFound', 'notPending'],
    ['offline', 'offline'],
    ['notActive', 'failed'],
    ['unknown', 'failed'],
  ] as const)('maps the API error %s to %s and still wipes', async (kind, result) => {
    const { service, seen } = setup({ approve: kind });
    expect(await service.approve(request)).toBe(result);
    expect(seen.dek).toEqual(new Uint8Array(32));
    expect(seen.ephemeralPrivate).toEqual(new Uint8Array(32));
  });

  it('returns failed on an invalid public key of the new phone', async () => {
    const { service, api } = setup();
    const bad = { ...request, newDevicePublicKey: new Uint8Array(32) };
    expect(await service.approve(bad)).toBe('failed');
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('returns failed for an unexpected error', async () => {
    const { service } = setup({ approve: new Error('boom') });
    expect(await service.approve(request)).toBe('failed');
  });
});

describe('reject', () => {
  it('rejects the request', async () => {
    const { service, api } = setup();
    expect(await service.reject(ID)).toBe('rejected');
    expect(api.reject).toHaveBeenCalledWith(ID);
  });

  it.each([
    ['expired', 'expired'],
    ['notPending', 'notPending'],
    ['offline', 'offline'],
    ['unknown', 'failed'],
  ] as const)('maps %s to %s', async (kind, result) => {
    const { service } = setup({ reject: kind });
    expect(await service.reject(ID)).toBe(result);
  });
});
