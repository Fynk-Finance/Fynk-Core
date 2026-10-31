// Restore on a new phone with the old phone's approval (HU-046, ADR 0002 "A new phone with
// approval"). The old phone seals the DEK for this phone's X25519 key; the server hands the grant
// over once. Nothing here logs: ids, codes, keys and device names never reach an error or a result.
import { approvalCode } from '../domain/crypto';
import { openGrant } from '../domain/deviceApproval';
import type { CompleteRestore } from './completeRestore';
import { isApprovalError, type DeviceApprovalsApiPort } from './ports';

/** The request is on the server. `code` is what the old phone shows next to the device name. */
export type ApprovalStart =
  | { status: 'started'; id: string; code: string; expiresAt: string }
  | { status: 'alreadyActive' | 'offline' | 'failed' };

/**
 * `waiting`: nobody decided yet. `grantLost`: approved, but the grant was read already (an
 * earlier answer was lost), so this phone is active without a key and needs the recovery code.
 */
export type ApprovalCheck =
  'waiting' | 'rejected' | 'expired' | 'grantLost' | 'restored' | 'partial' | 'offline' | 'failed';

export interface RestoreWithApprovalDeps {
  api: Pick<DeviceApprovalsApiPort, 'create' | 'get'>;
  randomBytes: (length: number) => Uint8Array;
  /** Identity's X25519 public key of this phone. Null when it has none. */
  devicePublicKey: () => Promise<Uint8Array | null>;
  /** Identity's shared secret with a peer key. The private key never leaves identity. */
  deviceSharedSecret: (peerPublicKey: Uint8Array) => Promise<Uint8Array>;
  completeRestore: CompleteRestore;
}

export interface RestoreWithApproval {
  /** Asks the active phones to approve this one. Every call is a new request. */
  start(): Promise<ApprovalStart>;
  /**
   * One look at the request. An approved one with its grant is opened and restored; `onRestoring`
   * is called when the grant arrives (it cannot be read again), so the UI can show the spinner.
   */
  check(id: string, onRestoring?: () => void): Promise<ApprovalCheck>;
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function createRestoreWithApproval(deps: RestoreWithApprovalDeps): RestoreWithApproval {
  return {
    async start() {
      try {
        const publicKey = await deps.devicePublicKey();
        if (!publicKey) return { status: 'failed' };
        // A new key per request: "Pedir de nuevo" must not return the rejected one.
        const request = await deps.api.create(hex(deps.randomBytes(16)));
        return {
          status: 'started',
          id: request.id,
          code: approvalCode(publicKey),
          expiresAt: request.expiresAt,
        };
      } catch (error) {
        if (isApprovalError(error, 'alreadyActive')) return { status: 'alreadyActive' };
        if (isApprovalError(error, 'offline')) return { status: 'offline' };
        return { status: 'failed' };
      }
    },

    async check(id, onRestoring) {
      let state: Awaited<ReturnType<DeviceApprovalsApiPort['get']>>;
      try {
        state = await deps.api.get(id);
      } catch (error) {
        if (isApprovalError(error, 'offline')) return 'offline';
        return isApprovalError(error, 'expired') ? 'expired' : 'failed';
      }
      switch (state.status) {
        case 'pending':
          return 'waiting';
        case 'rejected':
        case 'expired':
          return state.status;
      }
      // Approved. The server gives the grant once, so no grant means an earlier answer was lost.
      const { grant } = state;
      if (!grant) return 'grantLost';

      // The grant is spent from here on, whatever follows.
      onRestoring?.();
      let shared: Uint8Array | null = null;
      let dek: Uint8Array | null = null;
      try {
        try {
          shared = await deps.deviceSharedSecret(grant.ephemeralPublicKey);
          dek = openGrant({
            shared,
            nonce: grant.nonce,
            wrappedDek: grant.wrappedDek,
            approvalId: id,
          });
        } catch {
          // Wrong key, id or bytes: nothing was opened, nothing is written.
          return 'failed';
        }
        return await deps.completeRestore(dek);
      } finally {
        shared?.fill(0);
        dek?.fill(0);
      }
    },
  };
}
