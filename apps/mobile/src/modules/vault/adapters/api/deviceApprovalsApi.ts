// DeviceApprovalsApiPort over the shared API client (the five /device-approvals calls).
import { api, isApiError, unwrap, type ApiClient } from '@shared/api';

import { fromBase64, toBase64 } from '../../domain/base64';
import {
  ApprovalError,
  type ApprovalGrant,
  type ApprovalRequest,
  type ApprovalState,
  type DeviceApprovalsApiPort,
  type PendingApproval,
} from '../../application/ports';

function toApprovalError(e: unknown): ApprovalError {
  if (e instanceof ApprovalError) return e;
  if (!isApiError(e)) return new ApprovalError('unknown');
  switch (e.code) {
    case 'network_error':
      return new ApprovalError('offline');
    case 'approval_not_found':
      return new ApprovalError('notFound');
    case 'approval_not_pending':
      return new ApprovalError('notPending');
    case 'approval_expired':
      return new ApprovalError('expired');
    case 'device_already_active':
      return new ApprovalError('alreadyActive');
    case 'device_not_active':
      return new ApprovalError('notActive');
    default:
      return new ApprovalError('unknown');
  }
}

/** Decodes a field and checks its size. Null when it is not what the contract says. */
function decode(text: string | undefined, length: number): Uint8Array | null {
  if (text === undefined) return null;
  const bytes = fromBase64(text);
  return bytes && bytes.length === length ? bytes : null;
}

const toRequest = (r: ApprovalRequest): ApprovalRequest => ({
  id: r.id,
  status: r.status,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
});

/** `deviceId` is read on every call: the phone may register after the app starts. */
export function createDeviceApprovalsApi(
  deviceId: () => string | null,
  client: ApiClient = api,
): DeviceApprovalsApiPort {
  // Without a registered device the API would answer 403 anyway.
  const header = () => {
    const id = deviceId();
    if (!id) throw new ApprovalError('notActive');
    return { 'X-Device-Id': id };
  };

  return {
    async create(idempotencyKey) {
      try {
        return toRequest(
          await unwrap(
            client.POST('/device-approvals', {
              params: { header: { ...header(), 'Idempotency-Key': idempotencyKey } },
            }),
          ),
        );
      } catch (e) {
        throw toApprovalError(e);
      }
    },
    async get(id) {
      try {
        const s = await unwrap(
          client.GET('/device-approvals/{id}', {
            params: { header: header(), path: { id } },
          }),
        );
        const ephemeralPublicKey = decode(s.ephemeralPublicKey, 32);
        const wrappedDek = decode(s.wrappedDek, 48);
        const nonce = decode(s.nonce, 12);
        const state: ApprovalState = { id: s.id, status: s.status, expiresAt: s.expiresAt };
        // A grant that is incomplete or the wrong size is dropped: opening it could not work.
        if (ephemeralPublicKey && wrappedDek && nonce) {
          state.grant = { ephemeralPublicKey, wrappedDek, nonce };
        }
        return state;
      } catch (e) {
        throw toApprovalError(e);
      }
    },
    async listPending() {
      try {
        const { approvals } = await unwrap(
          client.GET('/device-approvals/pending', { params: { header: header() } }),
        );
        const pending: PendingApproval[] = [];
        for (const a of approvals) {
          // A request whose key is not 32 bytes cannot be approved, so it is not shown.
          const newDevicePublicKey = decode(a.newDevicePublicKey, 32);
          if (!newDevicePublicKey) continue;
          pending.push({
            id: a.id,
            deviceName: a.deviceName,
            platform: a.platform,
            newDevicePublicKey,
            createdAt: a.createdAt,
            expiresAt: a.expiresAt,
          });
        }
        return pending;
      } catch (e) {
        throw toApprovalError(e);
      }
    },
    async approve(id, grant: ApprovalGrant) {
      try {
        return toRequest(
          await unwrap(
            client.POST('/device-approvals/{id}/approve', {
              params: { header: header(), path: { id } },
              body: {
                ephemeralPublicKey: toBase64(grant.ephemeralPublicKey),
                wrappedDek: toBase64(grant.wrappedDek),
                nonce: toBase64(grant.nonce),
              },
            }),
          ),
        );
      } catch (e) {
        throw toApprovalError(e);
      }
    },
    async reject(id) {
      try {
        return toRequest(
          await unwrap(
            client.POST('/device-approvals/{id}/reject', {
              params: { header: header(), path: { id } },
            }),
          ),
        );
      } catch (e) {
        throw toApprovalError(e);
      }
    },
  };
}
