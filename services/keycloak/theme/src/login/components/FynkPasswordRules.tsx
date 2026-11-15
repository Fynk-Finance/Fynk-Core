import { strings } from '../strings.es-CO';
import { CheckIcon } from './FynkIcons';

const t = strings.reset;

// The checks match the realm password policy (length(8), a letter and a digit, specialChars(1)).
// Keycloak counts as special any character that is not a letter or a digit. `notEmail` and
// `passwordHistory(1)` (not the current password) are enforced by Keycloak and shown as its error:
// the page knows neither the address (account enumeration) nor the current password.
export const passwordRules = [
  { id: 'length', label: t.ruleLength, test: (value: string) => value.length >= 8 },
  {
    id: 'alphanumeric',
    label: t.ruleAlphanumeric,
    test: (value: string) => /[A-Za-z]/.test(value) && /[0-9]/.test(value),
  },
  { id: 'special', label: t.ruleSpecial, test: (value: string) => /[^\p{L}\p{N}]/u.test(value) },
] as const;

// Live checklist under the new password field. New composition, needs design review.
export function FynkPasswordRules({ value, id }: { value: string; id: string }) {
  return (
    <ul className="fk-rules" id={id} aria-label={t.rulesLabel}>
      {passwordRules.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} className="fk-rule" data-met={met}>
            <span className="fk-rule-mark" aria-hidden="true">
              {met && <CheckIcon size={12} />}
            </span>
            <span>{rule.label}</span>
            <span className="fk-sr-only">{met ? ' (cumplido)' : ' (pendiente)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
