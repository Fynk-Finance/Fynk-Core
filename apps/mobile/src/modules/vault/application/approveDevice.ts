// The old phone's side of a device approval (HU-046): list the requests, check the owner, seal the
// DEK for the new phone and hand it to the server. Never log keys, codes or device names.
import { NONCE_LENGTH, approvalCode } from '../domain/crypto';
import { sealGrant } from '../domain/deviceApproval';
import { isApprovalError, type DeviceApprovalsApiPort, type PendingApproval } from './ports';

/** An X25519 key pair made for one approval. */
export interface EphemeralKeys {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** X25519 behind a port, so this layer imports no crypto library. */
export interface KeyAgreementPort {
  generate(): EphemeralKeys;
  /** Throws when the peer key is invalid. */
  sharedSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
}

/**
 * Asks the person for biometrics or the password, even when the vault is open. Returns the DEK,
 * or null when the person cancels. Throws when the check failed for another reason.
 */
export type ConfirmOwner = () => Promise<Uint8Array | null>;

export interface ApproveDeviceDeps {
  api: Pick<DeviceApprovalsApiPort, 'listPending' | 'approve' | 'reject'>;
  randomBytes: (length: number) => Uint8Array;
  keys: KeyAgreementPort;
  confirmOwner: ConfirmOwner;
}

/** A request with the 6 digit code the person compares with the new phone. */
export interface ApprovalRequestView extends PendingApproval {
  code: string;
}

export type ApproveResult =
  'approved' | 'cancelled' | 'expired' | 'notPending' | 'offline' | 'failed';

export type RejectResult = 'rejected' | 'expired' | 'notPending' | 'offline' | 'failed';

export interface ApproveDeviceService {
  listPending(): Promise<ApprovalRequestView[]>;
  approve(request: PendingApproval): Promise<ApproveResult>;
  reject(id: string): Promise<RejectResult>;
}

function failureOf(e: unknown): 'expired' | 'notPending' | 'offline' | 'failed' {
  if (isApprovalError(e, 'expired')) return 'expired';
  // A request that is gone or taken is the same news for the person: it cannot be approved now.
  if (isApprovalError(e, 'notPending') || isApprovalError(e, 'notFound')) return 'notPending';
  if (isApprovalError(e, 'offline')) return 'offline';
  return 'failed';
}

export function createApproveDeviceService(deps: ApproveDeviceDeps): ApproveDeviceService {
  return {
    async listPending() {
      const pending = await deps.api.listPending();
      return pending.map((p) => ({ ...p, code: approvalCode(p.newDevicePublicKey) }));
    },

    async approve(request) {
      let dek: Uint8Array | null = null;
      let ephemeral: EphemeralKeys | null = null;
      let shared: Uint8Array | null = null;
      try {
        dek = await deps.confirmOwner();
        if (!dek) return 'cancelled';
        ephemeral = deps.keys.generate();
        shared = deps.keys.sharedSecret(ephemeral.privateKey, request.newDevicePublicKey);
        const nonce = deps.randomBytes(NONCE_LENGTH);
        const wrappedDek = sealGrant({ shared, nonce, dek, approvalId: request.id });
        await deps.api.approve(request.id, {
          ephemeralPublicKey: ephemeral.publicKey,
          wrappedDek,
          nonce,
        });
        return 'approved';
      } catch (e) {
        return failureOf(e);
      } finally {
        // Nothing secret outlives the call.
        dek?.fill(0);
        shared?.fill(0);
        ephemeral?.privateKey.fill(0);
      }
    },

    async reject(id) {
      try {
        await deps.api.reject(id);
        return 'rejected';
      } catch (e) {
        return failureOf(e);
      }
    },
  };
}
