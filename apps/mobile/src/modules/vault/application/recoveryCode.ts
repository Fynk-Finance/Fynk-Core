// Makes a recovery code and the wrapped DEK it protects (HU-045).
// The code exists only in memory, only while it is shown: it is never stored and never sent.
// Only the DEK wrapped with the key derived from it goes to the server, and only on commit.
import { deriveDeviceProof, deviceProofHash, NONCE_LENGTH } from '../domain/crypto';
import {
  encodeRecoveryCode,
  formatRecoveryCode,
  matchesRecoveryGroup,
} from '../domain/recoveryCode';
import { RECOVERY_KDF, SALT_LENGTH, wrapDek } from '../domain/recoveryKey';
import { isRecoveryError, type RandomBytes, type RecoveryKdf, type RecoveryKeyApi } from './ports';

/** 128 bits, the size encodeRecoveryCode needs. */
const CODE_BYTES = 16;

export interface PreparedRecoveryCode {
  /** The 5 groups of the code, as shown: `XXXXX XXXXX XXXXX XXXXX XXXXXX`. */
  groups: string[];
  /** The last group, which the person types to prove they saved the code. */
  lastGroup: string;
  /** Uploads the wrapped DEK. It replaces the previous recovery key, so the old code stops working. */
  commit(): Promise<void>;
}

export type ConfirmResult = 'ok' | 'mismatch' | 'offline' | 'failed';

/**
 * Step 2 of the screen: the typed last group must match, then the wrapped DEK is uploaded.
 * A wrong group uploads nothing, so a code that was not saved never replaces a working one.
 */
export async function confirmRecoveryCode(
  prepared: PreparedRecoveryCode,
  typedLastGroup: string,
): Promise<ConfirmResult> {
  if (!matchesRecoveryGroup(typedLastGroup, prepared.lastGroup)) return 'mismatch';
  try {
    await prepared.commit();
    return 'ok';
  } catch (error) {
    return isRecoveryError(error, 'offline') ? 'offline' : 'failed';
  }
}

export interface RecoveryCodeService {
  /** Makes a code and derives everything from it. Uploads nothing until `commit`. */
  prepare(dek: Uint8Array): Promise<PreparedRecoveryCode>;
}

export interface RecoveryCodeDeps {
  random: RandomBytes;
  kdf: RecoveryKdf;
  api: RecoveryKeyApi;
}

export function createRecoveryCodeService({
  random,
  kdf,
  api,
}: RecoveryCodeDeps): RecoveryCodeService {
  return {
    async prepare(dek) {
      const code = encodeRecoveryCode(random(CODE_BYTES));
      const salt = random(SALT_LENGTH);
      const nonce = random(NONCE_LENGTH);
      const rk = await kdf(code, salt);
      const upload = {
        wrappedDek: wrapDek(rk, nonce, dek),
        nonce,
        salt,
        kdfParams: { ...RECOVERY_KDF },
        deviceProofHash: deviceProofHash(deriveDeviceProof(dek)),
      };
      const groups = formatRecoveryCode(code).split(' ');
      return {
        groups,
        lastGroup: groups[groups.length - 1] ?? '',
        commit: () => api.put(upload),
      };
    },
  };
}
