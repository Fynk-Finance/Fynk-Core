import { useState } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { strings } from '../strings.es-CO';
import { FynkAlert } from '../components/FynkAlert';
import { FynkButton } from '../components/FynkButton';
import { FynkField } from '../components/FynkField';
import { FynkLayout } from '../components/FynkLayout';
import { FynkPasswordRules } from '../components/FynkPasswordRules';
import { FynkProgress } from '../components/FynkProgress';
import { KcHtml } from '../components/KcHtml';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'login-update-password.ftl' }>;
  i18n: I18n;
};

const t = strings.reset;

// login-update-password.ftl, step 3 of the recovery flow: the new password, with the live checklist
// of the realm policy. Field names and form id are Keycloak's. Keycloak's "close other sessions"
// checkbox is not drawn: the reset already closes them (see the success page). The page reads
// nothing from `auth` or `user`.
//
// The same template also serves the password change the app starts from Seguridad
// (`kc_action=UPDATE_PASSWORD`, `isAppInitiatedAction`): no recovery steps or copy, a hidden
// `logout-sessions=on` (Keycloak's checkbox name) so the other sessions end, and a Cancelar submit
// (`cancel-aia=true`, Keycloak's cancel of an application initiated action).
// Keycloak's global message is shown only when it is an error: the "Tienes que cambiar tu
// contraseña." warning just repeats the title.
export default function UpdatePassword({ kcContext }: Props) {
  const { url, message, messagesPerField } = kcContext;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const passwordError = messagesPerField.existsError('password')
    ? messagesPerField.get('password')
    : undefined;
  const confirmError = messagesPerField.existsError('password-confirm')
    ? messagesPerField.get('password-confirm')
    : undefined;
  const hasFieldError = passwordError !== undefined || confirmError !== undefined;
  const globalMessage =
    message !== undefined && message.type === 'error' && !hasFieldError ? message : undefined;
  const isChange = kcContext.isAppInitiatedAction === true;
  const c = t.change;

  return (
    <FynkLayout
      documentTitle={isChange ? c.pageTitle : t.pageTitle}
      headerTitle={isChange ? c.headerTitle : t.headerTitle}
      headerSubtitle={isChange ? c.headerSubtitle : t.headerSubtitle}
      flow={{}}
    >
      {!isChange && <FynkProgress step={3} total={3} label={t.stepLabel(3, 3)} />}
      <div className="fk-step">
        <div className="fk-card-intro">
          <h2 className="fk-card-title">{isChange ? c.title : t.newPasswordTitle}</h2>
          <p className="fk-card-subtitle">{isChange ? c.subtitle : t.newPasswordSubtitle}</p>
        </div>

        {globalMessage !== undefined && (
          <FynkAlert type={globalMessage.type} summary={globalMessage.summary} />
        )}

        <form
          id="kc-passwd-update-form"
          className="fk-form fk-form--grow"
          action={url.loginAction}
          method="post"
          noValidate
        >
          <FynkField
            id="password-new"
            name="password-new"
            label={t.newPasswordLabel}
            type="password"
            icon="lock"
            autoComplete="new-password"
            placeholder={t.newPasswordPlaceholder}
            spacing="tight"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            describedBy="password-rules"
            error={passwordError !== undefined ? <KcHtml html={passwordError} /> : undefined}
          />
          <FynkPasswordRules value={password} id="password-rules" />
          <FynkField
            id="password-confirm"
            name="password-confirm"
            label={t.confirmLabel}
            type="password"
            icon="lock"
            autoComplete="new-password"
            placeholder={t.confirmPlaceholder}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={confirmError !== undefined ? <KcHtml html={confirmError} /> : undefined}
          />
          <div className="fk-spacer" />
          {isChange && <input type="hidden" name="logout-sessions" value="on" />}
          <FynkButton label={t.savePassword} />
          {isChange && (
            <button
              className="fk-link fk-link--center"
              type="submit"
              name="cancel-aia"
              value="true"
            >
              {c.cancel}
            </button>
          )}
        </form>
      </div>
    </FynkLayout>
  );
}
