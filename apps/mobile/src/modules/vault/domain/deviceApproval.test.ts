import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { approvalCode, VaultCryptoError } from './crypto';
import { APPROVAL_INFO, approvalKey, openGrant, sealGrant } from './deviceApproval';

const bytes = (length: number, start = 0) => Uint8Array.from({ length }, (_, i) => start + i);
const hex = bytesToHex;

const ID = '4a6e8c10-2b3d-4f5a-8c7e-9d1b3f5a7c20';
const DEK = bytes(32, 100);
const NONCE = bytes(12, 7);
const NEW_PRIVATE = bytes(32, 1);
const EPHEMERAL_PRIVATE = bytes(32, 50);
const NEW_PUBLIC = x25519.getPublicKey(NEW_PRIVATE);
const EPHEMERAL_PUBLIC = x25519.getPublicKey(EPHEMERAL_PRIVATE);

const oldSide = () => x25519.getSharedSecret(EPHEMERAL_PRIVATE, NEW_PUBLIC);
const newSide = () => x25519.getSharedSecret(NEW_PRIVATE, EPHEMERAL_PUBLIC);

it('uses the info string fixed by ADR 0002', () => {
  expect(APPROVAL_INFO).toBe('fynk/device-approval/v1');
});

// Vectors made with Node's crypto (hkdfSync and aes-256-gcm), not with the code under test.
describe('fixed vectors', () => {
  it('derives the approval key from the shared secret 00 01 ... 1f', () => {
    expect(hex(approvalKey(bytes(32)))).toBe(
      '2cfacbe6128eeec19f04165c4ff8b97f225e1bb21552d0c3499edabc3da5f044',
    );
  });

  it('seals the DEK with the approval id as UTF-8 AAD', () => {
    const wrapped = sealGrant({ shared: bytes(32), nonce: NONCE, dek: DEK, approvalId: ID });
    expect(hex(wrapped)).toBe(
      'bbaca38bcf7d6d138df9c15c3e59b6857772092779ea67d9d380041bb6872ecf17ddab716a33a8ae7db5da9df82bba72',
    );
  });
});

describe('approvalKey', () => {
  it('is deterministic and depends on the secret', () => {
    expect(approvalKey(bytes(32))).toEqual(approvalKey(bytes(32)));
    expect(approvalKey(bytes(32))).not.toEqual(approvalKey(bytes(32, 1)));
  });

  it('rejects a secret that is not 32 bytes', () => {
    expect(() => approvalKey(bytes(31))).toThrow(VaultCryptoError);
    expect(() => approvalKey(bytes(33))).toThrow(VaultCryptoError);
  });
});

describe('sealGrant and openGrant', () => {
  it('round trips with real X25519 on both sides', () => {
    const shared = oldSide();
    expect(newSide()).toEqual(shared);
    const wrapped = sealGrant({ shared, nonce: NONCE, dek: DEK, approvalId: ID });
    expect(wrapped).toHaveLength(48);
    const opened = openGrant({
      shared: newSide(),
      nonce: NONCE,
      wrappedDek: wrapped,
      approvalId: ID,
    });
    expect(opened).toEqual(DEK);
  });

  it('does not leak the DEK in clear', () => {
    const wrapped = sealGrant({ shared: oldSide(), nonce: NONCE, dek: DEK, approvalId: ID });
    expect(hex(wrapped)).not.toContain(hex(DEK));
  });

  it('binds the grant to the approval id, whatever its case', () => {
    const wrapped = sealGrant({ shared: oldSide(), nonce: NONCE, dek: DEK, approvalId: ID });
    const other = '4a6e8c10-2b3d-4f5a-8c7e-9d1b3f5a7c21';
    expect(() =>
      openGrant({ shared: newSide(), nonce: NONCE, wrappedDek: wrapped, approvalId: other }),
    ).toThrow(VaultCryptoError);
    expect(
      openGrant({
        shared: newSide(),
        nonce: NONCE,
        wrappedDek: wrapped,
        approvalId: ID.toUpperCase(),
      }),
    ).toEqual(DEK);
  });

  it('fails with a changed byte, a wrong nonce or a wrong key', () => {
    const wrapped = sealGrant({ shared: oldSide(), nonce: NONCE, dek: DEK, approvalId: ID });
    const attempt = (over: Partial<Parameters<typeof openGrant>[0]>) =>
      openGrant({ shared: newSide(), nonce: NONCE, wrappedDek: wrapped, approvalId: ID, ...over });

    for (const i of [0, 20, 47]) {
      const changed = wrapped.slice();
      changed[i] = (changed[i] ?? 0) ^ 1;
      expect(() => attempt({ wrappedDek: changed })).toThrow(VaultCryptoError);
    }
    expect(() => attempt({ nonce: bytes(12, 8) })).toThrow(VaultCryptoError);
    const stranger = x25519.getSharedSecret(bytes(32, 90), EPHEMERAL_PUBLIC);
    expect(() => attempt({ shared: stranger })).toThrow(VaultCryptoError);
    expect(() => attempt({ wrappedDek: wrapped.slice(0, 47) })).toThrow(VaultCryptoError);
  });

  it('rejects a DEK of the wrong size and a short nonce', () => {
    expect(() =>
      sealGrant({ shared: oldSide(), nonce: NONCE, dek: bytes(16), approvalId: ID }),
    ).toThrow(VaultCryptoError);
    expect(() =>
      sealGrant({ shared: oldSide(), nonce: bytes(8), dek: DEK, approvalId: ID }),
    ).toThrow(VaultCryptoError);
  });
});

it('shows the same 6 digit code on both phones', () => {
  // The old phone computes it from the key the server sent, the new phone from its own.
  const code = approvalCode(NEW_PUBLIC);
  expect(approvalCode(Uint8Array.from(NEW_PUBLIC))).toBe(code);
  expect(code).toMatch(/^\d{6}$/);
  expect(approvalCode(x25519.getPublicKey(bytes(32, 9)))).not.toBe(code);
});
