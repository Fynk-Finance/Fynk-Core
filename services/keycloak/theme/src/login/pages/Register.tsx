import { useUserProfileForm, type FormFieldState } from 'keycloakify/login/lib/useUserProfileForm';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { strings } from '../strings.es-CO';
import { FynkAlert } from '../components/FynkAlert';
import { FynkButton } from '../components/FynkButton';
import { FynkField } from '../components/FynkField';
import { FynkLayout } from '../components/FynkLayout';
import { KcHtml } from '../components/KcHtml';
import { TermsCheckbox } from '../components/TermsCheckbox';

type Props = {
  kcContext: Extract<KcContext, { pageId: 'register.ftl' }>;
  i18n: I18n;
};

const t = strings.register;

// Attributes of Keycloak's user profile that the design shows. First and last name are optional in
// the realm and the design does not draw them, so they are not rendered (and not posted).
const IGNORED_OPTIONAL = new Set(['username', 'firstName', 'lastName']);

function isShown({ attribute }: FormFieldState) {
  if (attribute.annotations.inputType === 'hidden') return false;
  if (['email', 'password', 'password-confirm'].includes(attribute.name)) return true;
  return attribute.required && !IGNORED_OPTIONAL.has(attribute.name);
}

// register.ftl. Form id and field names (email, password, password-confirm, termsAccepted) are the
// ones Keycloak and the integration tests rely on. The password fields come from the user profile
// form when Keycloak sets `passwordRequired`, which the realm turns on to match the design.
export default function Register({ kcContext, i18n }: Props) {
  const { url, messagesPerField, message, termsAcceptanceRequired } = kcContext;

  const {
    formState: { formFieldStates },
    dispatchFormAction,
  } = useUserProfileForm({ kcContext, i18n, doMakeUserConfirmPassword: true });

  const shown = formFieldStates.filter(isShown);
  const showGlobal = message !== undefined && messagesPerField.exists('global');

  return (
    <FynkLayout
      documentTitle={t.pageTitle}
      headerTitle={t.headerTitle}
      headerSubtitle={t.headerSubtitle}
    >
      <div className="fk-card-intro fk-card-intro--tight">
        <h2 className="fk-card-title">{t.cardTitle}</h2>
        <p className="fk-card-subtitle">{t.cardSubtitle}</p>
      </div>

      {showGlobal && <FynkAlert type={message.type} summary={message.summary} />}

      <form
        id="kc-register-form"
        className="fk-form"
        action={url.registrationAction}
        method="post"
        noValidate
      >
        {formFieldStates
          .filter((state) => state.attribute.annotations.inputType === 'hidden')
          .map(({ attribute, valueOrValues }) => (
            <input
              key={attribute.name}
              type="hidden"
              name={attribute.name}
              value={String(valueOrValues)}
            />
          ))}

        {shown.map((state, index) => {
          const { attribute, displayableErrors, valueOrValues } = state;
          const name = attribute.name;
          const isPassword = name === 'password';
          const isConfirm = name === 'password-confirm';
          const copy = isPassword
            ? { label: t.passwordLabel, placeholder: t.passwordPlaceholder, hint: t.passwordHint }
            : isConfirm
              ? {
                  label: t.passwordConfirmLabel,
                  placeholder: t.passwordConfirmPlaceholder,
                  hint: undefined,
                }
              : name === 'email'
                ? {
                    label: t.emailLabel,
                    placeholder: t.emailPlaceholder,
                    hint: undefined,
                  }
                : {
                    label: i18n.advancedMsgStr(attribute.displayName ?? name),
                    placeholder: undefined,
                    hint: undefined,
                  };
          const firstError = displayableErrors[0];

          return (
            <FynkField
              key={name}
              id={name}
              name={name}
              label={copy.label}
              type={isPassword || isConfirm ? 'password' : name === 'email' ? 'email' : 'text'}
              icon={isPassword || isConfirm ? 'lock' : name === 'email' ? 'mail' : undefined}
              autoComplete={isPassword || isConfirm ? 'new-password' : attribute.autocomplete}
              placeholder={copy.placeholder}
              hint={copy.hint}
              spacing={index === shown.length - 1 ? 'default' : 'tight'}
              value={String(valueOrValues)}
              error={firstError !== undefined ? firstError.errorMessage : undefined}
              onChange={(event) =>
                dispatchFormAction({ action: 'update', name, valueOrValues: event.target.value })
              }
              onBlur={() =>
                dispatchFormAction({ action: 'focus lost', name, fieldIndex: undefined })
              }
            />
          );
        })}

        <FynkButton label={t.submit} spaced />

        {termsAcceptanceRequired && (
          <TermsCheckbox
            error={
              messagesPerField.existsError('termsAccepted') ? (
                <KcHtml html={messagesPerField.get('termsAccepted')} />
              ) : undefined
            }
          />
        )}
      </form>

      <p className="fk-switch">
        {t.haveAccount}{' '}
        <a className="fk-link" href={url.loginUrl}>
          {t.login}
        </a>
      </p>
    </FynkLayout>
  );
}
