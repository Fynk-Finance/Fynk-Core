import type { KcContext } from '../KcContext';
import { strings } from '../strings.es-CO';
import { FynkLayout } from '../components/FynkLayout';
import { FynkStatus } from '../components/FynkStatus';
import { KcHtml } from '../components/KcHtml';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'error.ftl' }>;
};

const t = strings.error;

// error.ftl. Keycloak's own page has the element id `kc-error-message`; it is kept. The link back to
// the app is the client's base URL, which Keycloak only gives when the client has one set.
export default function ErrorPage({ kcContext }: Props) {
  const { message, client, skipLink } = kcContext;
  const baseUrl = client?.baseUrl;
  const showLink = skipLink !== true && baseUrl !== undefined && baseUrl !== '';

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
      flow={{}}
    >
      <FynkStatus
        tone="error"
        title={t.title}
        messageId="kc-error-message"
        action={showLink ? { href: baseUrl, label: t.backToApp } : undefined}
        noActionHint={t.closeHint}
      >
        <p className="fk-status-message">
          <KcHtml html={message.summary} />
        </p>
      </FynkStatus>
    </FynkLayout>
  );
}
