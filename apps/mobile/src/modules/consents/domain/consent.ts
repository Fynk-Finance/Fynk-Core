// Consent rules of Conectar banco (HU-006). Pure: no React, no I/O, same input, same output.
// The request must carry exactly what the screen showed, or the API refuses it (M4 backend).

/** Data an entity shares with Fynk, in the order the design lists them. */
export const SCOPES = ['balances', 'transactions', 'account_details'] as const;
export type ConsentScope = (typeof SCOPES)[number];

export type ConsentStatus = 'pending' | 'active' | 'revoked' | 'expired' | 'failed';

/** The published consent text (`GET /consent-texts/current`). */
export interface ConsentText {
  version: string;
  bodyMd: string;
  /** Hex SHA-256 of bodyMd, sent back as acceptance evidence. */
  sha256: string;
  publishedAt: string;
  purpose: string;
  termDays: number;
}

export interface Consent {
  id: string;
  provider: string;
  scopes: ConsentScope[];
  purpose: string;
  termDays: number;
  status: ConsentStatus;
  textVersion: string;
  createdAt: string;
  acceptedAt: string;
  grantedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  providerNotifiedAt?: string;
}

/** The entity being connected, as M5's `GET /providers` lists it. */
export interface ConsentProvider {
  id: string;
  displayName: string;
  supportedScopes: readonly string[];
}

export interface CreateConsentRequest {
  provider: string;
  scopes: ConsentScope[];
  purpose: string;
  termDays: number;
  textVersion: string;
  textSha256: string;
  appVersion: string;
  locale: string;
}

/** Fynk is only in Spanish (Colombia); the API accepts only this locale. */
export const CONSENT_LOCALE = 'es-CO';

const isScope = (s: string): s is ConsentScope => (SCOPES as readonly string[]).includes(s);

/** The scopes the provider shares, in display order, without unknown or repeated ones. */
export function scopesOf(provider: Pick<ConsentProvider, 'supportedScopes'>): ConsentScope[] {
  return SCOPES.filter((s) => provider.supportedScopes.filter(isScope).includes(s));
}

/** "12 meses" for whole years, "1 mes" or "N meses" for whole 30 day months, else "N días". */
export function termLabel(days: number): string {
  if (days > 0 && days % 365 === 0) return `${(days / 365) * 12} meses`;
  if (days > 0 && days % 30 === 0) return days === 30 ? '1 mes' : `${days / 30} meses`;
  return days === 1 ? '1 día' : `${days} días`;
}

/** "Finalidad: mostrarte … Vigencia: 12 meses.", from the text the API published. */
export function purposeAndTerm(text: Pick<ConsentText, 'purpose' | 'termDays'>): string {
  const purpose = text.purpose.trim();
  const sentence = purpose.charAt(0).toLocaleLowerCase('es-CO') + purpose.slice(1);
  const ended = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  return `Finalidad: ${ended} Vigencia: ${termLabel(text.termDays)}.`;
}

/** Builds the request from exactly what the screen showed: the provider's scopes and the text. */
export function buildConsentRequest(input: {
  provider: ConsentProvider;
  text: ConsentText;
  appVersion: string;
}): CreateConsentRequest {
  return {
    provider: input.provider.id,
    scopes: scopesOf(input.provider),
    purpose: input.text.purpose,
    termDays: input.text.termDays,
    textVersion: input.text.version,
    textSha256: input.text.sha256,
    appVersion: input.appVersion,
    locale: CONSENT_LOCALE,
  };
}

/** "Ir al portal" works only after the box is checked, with a text and something to share. */
export function canGoToPortal(state: {
  accepted: boolean;
  text: ConsentText | undefined;
  provider: ConsentProvider | undefined;
  submitting: boolean;
}): boolean {
  return (
    state.accepted &&
    state.text !== undefined &&
    state.provider !== undefined &&
    scopesOf(state.provider).length > 0 &&
    !state.submitting
  );
}

/**
 * What went wrong when recording the consent, from the API's problem code:
 * - `text_changed`: the text, purpose or term changed since it was shown; show it again;
 * - `device`: this phone is not registered yet (M1);
 * - `provider`: the entity cannot be connected now;
 * - `network`: the API could not be reached;
 * - `unknown`: anything else.
 */
export type ConsentErrorKind = 'text_changed' | 'device' | 'provider' | 'network' | 'unknown';

export function consentErrorKind(code: string | undefined): ConsentErrorKind {
  switch (code) {
    case 'unknown_text_version':
    case 'text_mismatch':
    case 'purpose_mismatch':
    case 'term_mismatch':
      return 'text_changed';
    case 'device_required':
      return 'device';
    case 'unsupported_provider':
    case 'invalid_scopes':
      return 'provider';
    case 'network_error':
      return 'network';
    default:
      return 'unknown';
  }
}
