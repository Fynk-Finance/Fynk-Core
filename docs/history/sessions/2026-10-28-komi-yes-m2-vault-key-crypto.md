---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8, SCRUM-62, SCRUM-63]
branch: feature/vault-key-crypto
tool: Claude Code
pr: none
status: done
---

# The vault's key hierarchy as pure functions

## Instruction

This is the first code of the M2 plan Daniel approved ("continue"). The prompt's key hierarchy becomes pure, tested functions: "BK backup key = HKDF-SHA256(DEK, info 'fynk/backup/v1')… Recovery code: 128 random bits shown as 26 Crockford base32 characters in 5 groups… 6 digit approval code: the first 4 bytes of SHA-256 of the new device public key…".

## What was done

* **`domain/crypto.ts`:**
  * `seal` and `open`: AES-256-GCM through `@noble/ciphers`, with AAD. Any change to the ciphertext, tag, nonce, key or AAD throws `VaultCryptoError`, which says nothing about the data.
  * `deriveBackupKey` and `deriveDeviceProof`: HKDF-SHA256 with `fynk/backup/v1` and `fynk/device-proof/v1`.
  * `deviceProofHash`.
  * `recordAad`: `userId|collection|recordId|version`.
  * `approvalCode`: the 6-digit code from the new phone's public key.

  No randomness inside: keys and nonces are parameters.
* **`domain/recoveryCode.ts`:**
  * `encodeRecoveryCode` (16 bytes to 26 characters) and `formatRecoveryCode` (5, 5, 5, 5 and 6);
  * `parseRecoveryCode`: accepts spaces, hyphens and lowercase, maps I and L to 1 and O to 0, and rejects U, other characters, a wrong length and non-zero padding;
  * `decodeRecoveryCode`.
* **Tests, all with fixed vectors:**
  * GCM checked against Node's `createCipheriv` and NIST GCM test case 16, and tampering with every part fails;
  * HKDF checked against Node's `hkdfSync`;
  * the approval code of 32 zero bytes is `123181`;
  * the recovery code of `00 01 … 0F` is `000G40R40M30E209185GR38E1W`, checked independently with Python;
  * round trips, tolerant parsing and rejections.

## Result

* `make lint-mobile`, `make test-mobile` and `make format-check` pass on the vault branch above this one (50 suites, 682 tests).

## Decisions and problems

* **Split from the vault engine** to keep each pull request under 400 lines. The engine is the next PR of the stack.
* **The proof's comment says the server sees it once.** A new phone sends it to be activated, and it is one-way: the DEK can't be derived from it.

## Next step

The SQLCipher engine (`feature/sqlcipher-vault`).
