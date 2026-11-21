import type { ReactNode } from 'react';
import { strings } from '../strings.es-CO';

const t = strings.register;

// Terms checkbox of the registration flow. The field name `termsAccepted` is Keycloak's.
// The design draws the document names as links, but the documents do not exist yet (open item),
// so they are bold text for now.
export function TermsCheckbox({ error }: { error?: ReactNode }) {
  return (
    <>
      <label className="fk-terms" htmlFor="termsAccepted">
        <input
          type="checkbox"
          id="termsAccepted"
          name="termsAccepted"
          aria-required="true"
          aria-invalid={error !== undefined}
          aria-describedby={error !== undefined ? 'termsAccepted-error' : undefined}
        />
        <span>
          {t.termsPrefix}
          <strong>{t.termsLink}</strong>
          {t.termsMiddle}
          <strong>{t.privacyLink}</strong>
          {t.termsSuffix}
        </span>
      </label>
      {error !== undefined && (
        <p className="fk-error fk-terms-error" id="termsAccepted-error" aria-live="polite">
          {error}
        </p>
      )}
    </>
  );
}
