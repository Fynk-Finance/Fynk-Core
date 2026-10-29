import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { strings } from '../strings.es-CO';
import { FynkAlert } from '../components/FynkAlert';
import { FynkButton } from '../components/FynkButton';
import { FynkField } from '../components/FynkField';
import { FynkInfoBox } from '../components/FynkInfoBox';
import { FynkLayout } from '../components/FynkLayout';
import { FynkProgress } from '../components/FynkProgress';
import { KcHtml } from '../components/KcHtml';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'login-reset-password.ftl' }>;
  i18n: I18n;
};

const t = strings.reset;

// login-reset-password.ftl, step 1 of Recuperar.html. Keycloak looks the account up when this form is
// posted, and the code page that follows looks the same with or without an account. `auth` is read
// here only to put back what the person typed, before any lookup.
export default function ResetPassword({ kcContext }: Props) {
  const { url, auth, message, messagesPerField } = kcContext;
  const hasFieldError = messagesPerField.existsError('username');
  const globalMessage = message !== undefined && !hasFieldError ? message : undefined;

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
      flow={{ backHref: url.loginUrl, backLabel: t.backToLogin }}
    >
      <FynkProgress step={1} total={3} label={t.stepLabel(1, 3)} />
      <div className="fk-step">
        <div className="fk-card-intro">
          <h2 className="fk-card-title">{t.requestTitle}</h2>
          <p className="fk-card-subtitle">{t.requestSubtitle}</p>
        </div>

        {globalMessage !== undefined && (
          <FynkAlert type={globalMessage.type} summary={globalMessage.summary} />
        )}

        <form
          id="kc-reset-password-form"
          className="fk-form fk-form--grow"
          action={url.loginAction}
          method="post"
          noValidate
        >
          <FynkField
            id="username"
            name="username"
            label={t.emailLabel}
            type="email"
            icon="mail"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            defaultValue={auth?.attemptedUsername ?? ''}
            spacing="tight"
            error={hasFieldError ? <KcHtml html={messagesPerField.get('username')} /> : undefined}
          />
          <FynkInfoBox tone="blue">{t.expiryNote}</FynkInfoBox>
          <div className="fk-spacer" />
          <FynkButton label={t.sendCode} />
        </form>
        <p className="fk-change">
          <a className="fk-link fk-link--center" href={url.loginUrl}>
            {t.backToLogin}
          </a>
        </p>
      </div>
    </FynkLayout>
  );
}
