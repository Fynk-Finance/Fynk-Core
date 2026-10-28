import { strings } from '../strings.es-CO';
import { CheckIcon } from './FynkIcons';

const t = strings.reset;

// The checks match the realm password policy (length(8), a letter, a digit). `notEmail` is enforced
// by Keycloak and shown as its error: the page must not know the address (account enumeration).
export const passwordRules = [
  { id: 'length', label: t.ruleLength, test: (value: string) => value.length >= 8 },
  { id: 'letter', label: t.ruleLetter, test: (value: string) => /[A-Za-z]/.test(value) },
  { id: 'number', label: t.ruleNumber, test: (value: string) => /[0-9]/.test(value) },
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
