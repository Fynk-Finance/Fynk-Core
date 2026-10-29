import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { strings } from '../strings.es-CO';
import { FynkAlert } from '../components/FynkAlert';
import { FynkButton } from '../components/FynkButton';
import { FynkField } from '../components/FynkField';
import { FynkLayout } from '../components/FynkLayout';
import { KcHtml } from '../components/KcHtml';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'login.ftl' }>;
  i18n: I18n;
};

const t = strings.login;

// login.ftl. The form id, field names and the hidden credentialId are the ones Keycloak and the
// integration tests (realm_integration_test.go) rely on.
export default function Login({ kcContext }: Props) {
  const {
    realm,
    url,
    usernameHidden,
    login,
    auth,
    message,
    messagesPerField,
    registrationDisabled,
  } = kcContext;

  const hasFieldError = messagesPerField.existsError('username', 'password');
  const fieldError = hasFieldError
    ? messagesPerField.getFirstError('username', 'password')
    : undefined;
  // Wrong credentials and locked accounts come as a field error; the rest (password updated,
  // account disabled...) come as a global message.
  const globalMessage = message !== undefined && !hasFieldError ? message : undefined;
  const errorId = 'password-error';

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
    >
      <div className="fk-card-intro">
        <h2 className="fk-card-title">{t.cardTitle}</h2>
        <p className="fk-card-subtitle">{t.cardSubtitle}</p>
      </div>

      {globalMessage !== undefined && (
        <FynkAlert type={globalMessage.type} summary={globalMessage.summary} />
      )}

      {realm.password && (
        <form
          id="kc-form-login"
          className="fk-form"
          action={url.loginAction}
          method="post"
          noValidate
        >
          {!usernameHidden && (
            <FynkField
              id="username"
              name="username"
              label={t.emailLabel}
              type={realm.registrationEmailAsUsername ? 'email' : 'text'}
              icon="mail"
              autoComplete="username"
              placeholder={t.emailPlaceholder}
              defaultValue={login.username ?? ''}
              invalid={hasFieldError}
              describedBy={hasFieldError ? errorId : undefined}
            />
          )}
          <FynkField
            id="password"
            name="password"
            label={t.passwordLabel}
            type="password"
            icon="lock"
            autoComplete="current-password"
            placeholder={t.passwordPlaceholder}
            spacing="last"
            error={fieldError !== undefined ? <KcHtml html={fieldError} /> : undefined}
          >
            {realm.resetPasswordAllowed && (
              <a className="fk-link fk-link--forgot" href={url.loginResetCredentialsUrl}>
                {t.forgotPassword}
              </a>
            )}
          </FynkField>
          <input
            type="hidden"
            id="id-hidden-input"
            name="credentialId"
            value={auth.selectedCredential}
          />
          <FynkButton id="kc-login" name="login" label={t.submit} />
        </form>
      )}

      {realm.registrationAllowed && !registrationDisabled && (
        <p className="fk-switch">
          {t.noAccount}{' '}
          <a className="fk-link" href={url.registrationUrl}>
            {t.register}
          </a>
        </p>
      )}
    </FynkLayout>
  );
}
