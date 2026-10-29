// Ports of the consents module. The adapter calls the Fynk API; tests use fakes.
import type { Consent, ConsentText, CreateConsentRequest } from '../domain/consent';

export interface ConsentsApiPort {
  /** `GET /consent-texts/current`: the text, purpose and term the app shows. */
  currentText(): Promise<ConsentText>;
  /** `POST /consents`: records the acceptance as a pending consent. The same key returns it again. */
  create(request: CreateConsentRequest, idempotencyKey: string): Promise<Consent>;
}

export interface ConsentsDeps {
  api: ConsentsApiPort;
  /** Version of the app, kept as acceptance evidence. */
  appVersion: string;
  newIdempotencyKey(): string;
}
