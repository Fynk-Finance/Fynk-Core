import { kcSanitize } from 'keycloakify/lib/kcSanitize';

// Text that comes from Keycloak and can hold basic HTML (field errors). Sanitized before it is shown.
export function KcHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: kcSanitize(html) }} />;
}
