import { useEffect, useState } from 'react';
import type { KcContext } from '../KcContext';
import { strings } from '../strings.es-CO';
import { FynkButton } from '../components/FynkButton';
import { FynkCodeInput } from '../components/FynkCodeInput';
import { FynkInfoBox } from '../components/FynkInfoBox';
import { FynkLayout } from '../components/FynkLayout';
import { FynkProgress } from '../components/FynkProgress';
import { KcHtml } from '../components/KcHtml';
import { MailTileIcon } from '../components/FynkIcons';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'fynk-email-code.ftl' }>;
};

const t = strings.code;
const r = strings.reset;

function toNumber(value: number | string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Seconds left until the next code can be asked for. The server value is the truth (it also enforces
// the cooldown); this only keeps the screen in step.
function useCountdown(initial: number) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return left;
}

// fynk-email-code.ftl, the page of the email-code extension (services/keycloak/extensions/email-code).
// The form contract is the extension's: form `kc-email-code-form` posting to `url.loginAction`, the
// field `code`, the buttons `verify` and `resend`, and in reset mode the link
// `kc-email-code-change-link`. The Go integration tests rely on them.
//
// Account enumeration: in reset mode the same page is shown for an email with an account and one
// without. So this component reads nothing from `auth` or `user`, only from the page's own
// attributes, and the build removes `auth` and `user` from the data embedded in the HTML (see
// postBuild.ts).
export default function EmailCode({ kcContext }: Props) {
  const { url, message, purpose, email } = kcContext;
  const minutes = toNumber(kcContext.minutes, 10);
  const remaining = useCountdown(Math.max(0, Math.ceil(toNumber(kcContext.cooldownSeconds, 0))));
  const isReset = purpose === 'reset';
  const hasError = message?.type === 'error';

  const describedBy = [
    'kc-email-code-instructions',
    ...(isReset ? [] : ['kc-email-code-expiry']),
    ...(message !== undefined ? ['code-message'] : []),
  ].join(' ');

  const form = (
    <form
      id="kc-email-code-form"
      className="fk-form fk-form--grow"
      action={url.loginAction}
      method="post"
      noValidate
    >
      <label className="fk-label fk-label--code" htmlFor="code">
        {t.label}
      </label>
      <FynkCodeInput describedBy={describedBy} invalid={hasError} />
      {message !== undefined && (
        <p
          className={hasError || message.type === 'warning' ? 'fk-error' : 'fk-hint'}
          id="code-message"
          role={hasError ? 'alert' : 'status'}
        >
          <KcHtml html={message.summary} />
        </p>
      )}
      {!isReset && (
        <p className="fk-hint" id="kc-email-code-expiry">
          {t.expiry(minutes)}
        </p>
      )}

      <div className="fk-resend">
        <span className="fk-resend-caption">{t.noCode}</span>
        {remaining > 0 ? (
          <span className="fk-resend-wait" role="timer">
            {t.resendIn} <span className="fk-resend-time">{formatClock(remaining)}</span>
          </span>
        ) : (
          <button
            className="fk-resend-button"
            id="kc-email-code-resend"
            type="submit"
            name="resend"
            value=""
            formNoValidate
          >
            {t.resend}
          </button>
        )}
      </div>

      {isReset ? (
        <FynkInfoBox tone="blue">{t.secureExpiry(minutes)}</FynkInfoBox>
      ) : (
        <FynkInfoBox tone="lime">{t.verifyInfo}</FynkInfoBox>
      )}

      <div className="fk-spacer" />
      <FynkButton
        id="kc-email-code-submit"
        name="verify"
        label={isReset ? r.verifyCode : t.verifySubmit}
      />
    </form>
  );

  if (!isReset) {
    return (
      <FynkLayout
        documentTitle={t.verifyPageTitle}
        headerTitle={t.verifyHeaderTitle}
        headerSubtitle={t.verifyHeaderSubtitle}
        flow={{}}
      >
        <div className="fk-step">
          <div className="fk-mail-card">
            <span className="fk-mail-tile">
              <MailTileIcon />
            </span>
            <span className="fk-mail-text" id="kc-email-code-instructions">
              <span className="fk-mail-caption">{t.sentTo}</span>
              <span className="fk-mail-address">{email}</span>
            </span>
          </div>
          {form}
        </div>
      </FynkLayout>
    );
  }

  return (
    <FynkLayout
      documentTitle={r.pageTitle}
      headerTitle={r.headerTitle}
      headerSubtitle={r.headerSubtitle}
      flow={{ backHref: url.loginRestartFlowUrl, backLabel: r.changeEmail }}
    >
      <FynkProgress step={2} total={3} label={r.stepLabel(2, 3)} />
      <div className="fk-step">
        <div className="fk-card-intro">
          <h2 className="fk-card-title">{r.codeTitle}</h2>
          <p className="fk-card-subtitle" id="kc-email-code-instructions">
            {r.codeSubtitle(email)}
          </p>
        </div>
        {form}
        <p id="kc-email-code-change" className="fk-change">
          <a
            className="fk-link fk-link--center"
            id="kc-email-code-change-link"
            href={url.loginRestartFlowUrl}
          >
            {r.changeEmail}
          </a>
        </p>
      </div>
    </FynkLayout>
  );
}
