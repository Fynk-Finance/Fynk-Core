import { VaultCryptoError, open, seal } from './crypto';
import { RECOVERY_AAD, RECOVERY_KDF, SALT_LENGTH, unwrapDek, wrapDek } from './recoveryKey';

const bytes = (length: number, start: number) => Uint8Array.from({ length }, (_, i) => start + i);
const RK = bytes(32, 1);
const NONCE = bytes(12, 100);
const DEK = bytes(32, 50);

it('uses the parameters of the contract', () => {
  expect(RECOVERY_KDF).toEqual({ memoryKiB: 65536, iterations: 3, parallelism: 1 });
  expect(SALT_LENGTH).toBe(16);
  expect(RECOVERY_AAD).toBe('fynk/recovery/v1');
});

it('wraps the DEK into 48 bytes and unwraps it back', () => {
  const wrapped = wrapDek(RK, NONCE, DEK);
  expect(wrapped).toHaveLength(48);
  expect(unwrapDek(RK, NONCE, wrapped)).toEqual(DEK);
});

it('is deterministic for the same inputs', () => {
  expect(wrapDek(RK, NONCE, DEK)).toEqual(wrapDek(RK, NONCE, DEK));
});

it('binds the AAD fynk/recovery/v1', () => {
  const wrapped = wrapDek(RK, NONCE, DEK);
  expect(open(RK, NONCE, wrapped, new TextEncoder().encode('fynk/recovery/v1'))).toEqual(DEK);
  const other = seal(RK, NONCE, DEK, new TextEncoder().encode('fynk/recovery/v2'));
  expect(() => unwrapDek(RK, NONCE, other)).toThrow(VaultCryptoError);
});

it('throws VaultCryptoError for a changed byte, nonce or key', () => {
  const wrapped = wrapDek(RK, NONCE, DEK);
  for (const index of [0, 31, 47]) {
    const changed = wrapped.slice();
    changed[index] = (changed[index] ?? 0) ^ 1;
    expect(() => unwrapDek(RK, NONCE, changed)).toThrow(VaultCryptoError);
  }
  expect(() => unwrapDek(RK, bytes(12, 101), wrapped)).toThrow(VaultCryptoError);
  expect(() => unwrapDek(bytes(32, 2), NONCE, wrapped)).toThrow(VaultCryptoError);
});
