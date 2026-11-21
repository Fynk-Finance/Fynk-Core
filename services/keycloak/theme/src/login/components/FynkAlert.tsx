import { kcSanitize } from 'keycloakify/lib/kcSanitize';

type Props = {
  type: 'success' | 'warning' | 'error' | 'info';
  /** Message from Keycloak, already localized. It can hold basic HTML. */
  summary: string;
};

// Keycloak's global message (locked account, password updated...) in the design's field style.
export function FynkAlert({ type, summary }: Props) {
  return (
    <div
      className={`fk-alert${type === 'error' ? ' fk-alert--error' : ''}`}
      role={type === 'error' ? 'alert' : 'status'}
      dangerouslySetInnerHTML={{ __html: kcSanitize(summary) }}
    />
  );
}
