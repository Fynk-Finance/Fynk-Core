// RecoveryKeyApi over the shared API client (PUT and GET /backup/recovery-key).
// Bytes become standard base64 here and nowhere else.
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import { RecoveryError, type RecoveryKeyApi } from '../../application/ports';
import { fromBase64, toBase64 } from '../../domain/base64';

export interface RecoveryKeyApiDeps {
  /** The registered device of this phone, sent as X-Device-Id. */
  deviceId: () => string | null;
  client?: ApiClient;
}

function toRecoveryError(e: unknown): RecoveryError {
  if (!isApiError(e)) return new RecoveryError('unknown');
  if (e.code === 'network_error') return new RecoveryError('offline');
  if (e.code === 'device_not_active') return new RecoveryError('notActive');
  return new RecoveryError('unknown');
}

export function createRecoveryKeyApi({
  deviceId,
  client = api,
}: RecoveryKeyApiDeps): RecoveryKeyApi {
  // Without a registered device the API would answer 400; say so before calling.
  const header = () => {
    const id = deviceId();
    if (!id) throw new RecoveryError('notActive');
    return { 'X-Device-Id': id };
  };

  return {
    async get() {
      try {
        const stored = await unwrap(
          client.GET('/backup/recovery-key', { params: { header: header() } }),
        );
        const wrappedDek = fromBase64(stored.wrappedDek);
        const nonce = fromBase64(stored.nonce);
        const salt = fromBase64(stored.salt);
        if (!wrappedDek || !nonce || !salt) throw new RecoveryError('unknown');
        return {
          wrappedDek,
          nonce,
          salt,
          kdfParams: {
            memoryKiB: stored.kdfParams.memoryKiB,
            iterations: stored.kdfParams.iterations,
            parallelism: stored.kdfParams.parallelism,
          },
          createdAt: stored.createdAt,
        };
      } catch (e) {
        if (e instanceof RecoveryError) throw e;
        if (isApiError(e) && e.code === 'recovery_key_not_found') return null;
        throw toRecoveryError(e);
      }
    },
    async put(upload) {
      try {
        await unwrap(
          client.PUT('/backup/recovery-key', {
            params: { header: header() },
            body: {
              wrappedDek: toBase64(upload.wrappedDek),
              nonce: toBase64(upload.nonce),
              salt: toBase64(upload.salt),
              kdf: 'argon2id',
              kdfParams: upload.kdfParams,
              deviceProofHash: toBase64(upload.deviceProofHash),
            },
          }),
        );
      } catch (e) {
        throw e instanceof RecoveryError ? e : toRecoveryError(e);
      }
    },
  };
}
