// Revoking a consent from the app (HU-008), and the two points where other modules plug in later:
//
// * Identity check: the M4 prompt asks for biometrics or the password before revoking. M2's
//   biometrics and an M1 password check do not exist yet, so until one of them installs a check
//   with `installIdentityCheck`, only the confirmation dialog protects the action.
// * Revocation listeners: M5 deletes the link's bank token from the vault when a consent is
//   revoked (M4 prompt). The vault does not exist yet, so M5 subscribes with `onConsentRevoked`
//   when it stores tokens (M5 step 3). M6's "Eliminar cuenta" calls `revokeConsent` and gets the
//   same notice.
import type { Consent } from '../domain/consent';
import type { ConsentsApiPort } from './ports';

export interface IdentityCheckRequest {
  reason: 'revoke_consent';
  /** The entity's display name, for the prompt ("Revocar el acceso de Banco Demo"). */
  entity: string;
}

/** Resolves true when the person proved it is them, false when they cancelled or failed. */
export type IdentityCheck = (request: IdentityCheckRequest) => Promise<boolean>;

export interface ConsentRevokedEvent {
  consentId: string;
  provider: string;
  revokedAt: string | undefined;
}

export type ConsentRevokedListener = (event: ConsentRevokedEvent) => void | Promise<void>;

export function createRevocation(api: Pick<ConsentsApiPort, 'revoke'>) {
  let identityCheck: IdentityCheck | null = null;
  const listeners = new Set<ConsentRevokedListener>();

  return {
    /** M1 or M2 install the biometric or password check here once it exists. */
    installIdentityCheck(check: IdentityCheck | null) {
      identityCheck = check;
    },
    /** Whether a real identity check is installed (the UI says so when it is not). */
    hasIdentityCheck: () => identityCheck !== null,
    /** Runs the installed check; without one there is nothing to ask and it passes. */
    async checkIdentity(request: IdentityCheckRequest): Promise<boolean> {
      return identityCheck ? identityCheck(request) : true;
    },
    /** Subscribes to revocations. Returns the function that unsubscribes. */
    onConsentRevoked(listener: ConsentRevokedListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * Ends the consent at once (the next sync answers 409 consent_revoked), then tells every
     * listener. A failing listener never undoes or hides the revocation, which already happened.
     */
    async revokeConsent(id: string): Promise<Consent> {
      const consent = await api.revoke(id);
      const event = {
        consentId: consent.id,
        provider: consent.provider,
        revokedAt: consent.revokedAt,
      };
      await Promise.all(
        [...listeners].map(async (listener) => {
          try {
            await listener(event);
          } catch {
            // The listener owns its retries (M5 deletes the token again on the next sync).
          }
        }),
      );
      return consent;
    },
  };
}

export type Revocation = ReturnType<typeof createRevocation>;
