import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { strings } from '../strings.es-CO';
import { FynkLayout } from '../components/FynkLayout';
import { FynkStatus } from '../components/FynkStatus';
import { KcHtml } from '../components/KcHtml';
import { appReturnUrl } from '../appReturnUrl';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'info.ftl' }>;
  i18n: I18n;
};

const t = strings.info;
const r = strings.reset;

// Keycloak ends the password recovery (END_AFTER_REQUIRED_ACTIONS) with an info page that carries the
// "accountUpdatedMessage" text as a success message, the header key `accountUpdatedTitle` (seen on
// the real image) and no required actions, and the login session is closed. Nothing else in this
// realm ends on an info page with those traits, so a success message that either is that text (the
// theme's own translation is the one the server uses) or has skipLink and no other header is the end
// of the recovery.
function isPasswordResetDone(kcContext: Props['kcContext'], i18n: I18n) {
  const { message, messageHeader, requiredActions, skipLink } = kcContext;
  if (message.type !== 'success') return false;
  if (
    messageHeader !== undefined &&
    messageHeader !== '' &&
    messageHeader !== 'accountUpdatedTitle'
  )
    return false;
  if (requiredActions !== undefined && requiredActions.length > 0) return false;
  return message.summary.trim() === i18n.msgStr('accountUpdatedMessage').trim() || skipLink;
}

// Where "Ir a iniciar sesión" goes. After the reset Keycloak closes the login session and gives no
// link (`skipLink`) and the client has no base URL (see appReturnUrl.ts), so the first usable URL
// wins: the ones Keycloak gives, then the app's own return URL taken from the login session, and
// finally the restart-flow URL.
function nextUrl(kcContext: Props['kcContext']) {
  const { pageRedirectUri, client, actionUri, url } = kcContext;
  return [
    pageRedirectUri,
    client?.baseUrl,
    actionUri,
    appReturnUrl(url?.loginRestartFlowUrl, url?.loginUrl),
    url?.loginRestartFlowUrl,
  ].find((candidate) => candidate !== undefined && candidate !== '');
}

// info.ftl. The element id `kc-info-message` is the one Keycloak uses and the integration tests look
// for. The recovery success is Recuperar's step 4 (not in the design export, needs design review);
// any other info page gets a generic Fynk version.
export default function Info({ kcContext, i18n }: Props) {
  const { message, messageHeader, requiredActions, skipLink } = kcContext;
  const next = nextUrl(kcContext);

  if (isPasswordResetDone(kcContext, i18n)) {
    return (
      <FynkLayout
        documentTitle={r.pageTitle}
        headerTitle={r.doneHeaderTitle}
        headerSubtitle={r.doneHeaderSubtitle}
        flow={{}}
      >
        <FynkStatus
          tone="success"
          title={r.doneTitle}
          messageId="kc-info-message"
          action={next !== undefined ? { href: next, label: r.goToLogin } : undefined}
          noActionHint={r.goToLoginFallback}
        >
          <p className="fk-status-message">{r.doneSubtitle}</p>
        </FynkStatus>
      </FynkLayout>
    );
  }

  const title =
    messageHeader !== undefined && messageHeader !== ''
      ? i18n.advancedMsgStr(messageHeader)
      : t.title;
  const actions =
    requiredActions !== undefined && requiredActions.length > 0
      ? ` <b>${requiredActions.map((action) => i18n.advancedMsgStr(`requiredAction.${action}`)).join(', ')}</b>`
      : '';

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
      flow={{}}
    >
      <FynkStatus
        tone={message.type === 'error' || message.type === 'warning' ? 'error' : 'success'}
        title={title}
        messageId="kc-info-message"
        action={!skipLink && next !== undefined ? { href: next, label: t.continue } : undefined}
      >
        <p className="fk-status-message">
          <KcHtml html={`${message.summary.trim()}${actions}`} />
        </p>
      </FynkStatus>
    </FynkLayout>
  );
}
