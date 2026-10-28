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
  const globalMessage = message !== undefined && !hasFieldError ? message : undefined;

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
      flow={{}}
    >
      <FynkProgress step={3} total={3} label={t.stepLabel(3, 3)} />
      <div className="fk-step">
        <div className="fk-card-intro">
          <h2 className="fk-card-title">{t.newPasswordTitle}</h2>
          <p className="fk-card-subtitle">{t.newPasswordSubtitle}</p>
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
          <FynkButton label={t.savePassword} />
        </form>
      </div>
    </FynkLayout>
  );
}
