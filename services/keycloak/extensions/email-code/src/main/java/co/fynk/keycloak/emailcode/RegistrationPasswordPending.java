package co.fynk.keycloak.emailcode;

import jakarta.ws.rs.core.MultivaluedMap;
import java.util.ArrayList;
import java.util.List;
import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.ValidationContext;
import org.keycloak.authentication.forms.RegistrationPage;
import org.keycloak.authentication.forms.RegistrationPassword;
import org.keycloak.credential.hash.PasswordHashProvider;
import org.keycloak.events.Errors;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.PasswordPolicy;
import org.keycloak.models.RealmModel;
import org.keycloak.models.credential.PasswordCredentialModel;
import org.keycloak.models.utils.FormMessage;
import org.keycloak.policy.PasswordPolicyManagerProvider;
import org.keycloak.policy.PolicyError;
import org.keycloak.services.messages.Messages;
import org.keycloak.services.validation.Validation;

/**
 * The registration form's password step, without a user to store it on. It keeps Keycloak's
 * checks and page. It remembers only a hash made with the realm's password policy, never the
 * plain password.
 *
 * <p>It always asks for the password on the form, as the design's "Crear cuenta" does. Keycloak's
 * step hides the password while email verification is on, unless its deprecated config
 * {@code always_set_password_on_register_form} is set, and then also skips every password check.
 * That mode exists against account pre-hijacking, which cannot happen here: no user exists until
 * the right email code. So this step does not depend on the config, and an execution added without
 * it (a hand-edited realm) still shows and checks the password.
 */
public class RegistrationPasswordPending extends RegistrationPassword {

    public static final String ID = "fynk-registration-password-pending";

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public String getDisplayType() {
        return "Password validation (hash kept until the email code)";
    }

    @Override
    public void buildPage(FormContext context, LoginFormsProvider form) {
        form.setAttribute("passwordRequired", true);
    }

    /** Keycloak's password checks, without its skip while email verification is on. */
    @Override
    public void validate(ValidationContext context) {
        MultivaluedMap<String, String> formData = context.getHttpRequest().getDecodedFormParameters();
        String password = formData.getFirst(RegistrationPage.FIELD_PASSWORD);
        List<FormMessage> errors = new ArrayList<>();
        if (Validation.isBlank(password)) {
            errors.add(new FormMessage(RegistrationPage.FIELD_PASSWORD, Messages.MISSING_PASSWORD));
        } else if (!password.equals(formData.getFirst(RegistrationPage.FIELD_PASSWORD_CONFIRM))) {
            errors.add(new FormMessage(RegistrationPage.FIELD_PASSWORD_CONFIRM, Messages.INVALID_PASSWORD_CONFIRM));
        }
        if (password != null) {
            String username = context.getRealm().isRegistrationEmailAsUsername()
                    ? formData.getFirst(RegistrationPage.FIELD_EMAIL)
                    : formData.getFirst(RegistrationPage.FIELD_USERNAME);
            PolicyError policyError = context.getSession().getProvider(PasswordPolicyManagerProvider.class)
                    .validate(username, password);
            if (policyError != null) {
                errors.add(new FormMessage(RegistrationPage.FIELD_PASSWORD, policyError.getMessage(),
                        policyError.getParameters()));
            }
        }
        if (!errors.isEmpty()) {
            context.error(Errors.INVALID_REGISTRATION);
            formData.remove(RegistrationPage.FIELD_PASSWORD);
            formData.remove(RegistrationPage.FIELD_PASSWORD_CONFIRM);
            context.validationError(formData, errors);
            return;
        }
        context.success();
    }

    @Override
    public void success(FormContext context) {
        MultivaluedMap<String, String> formData = context.getHttpRequest().getDecodedFormParameters();
        String password = formData.getFirst(RegistrationPage.FIELD_PASSWORD);
        if (password == null || password.isEmpty()) {
            // validate() rejects a form without a password, so this does not happen.
            return;
        }
        PasswordCredentialModel model = hash(context.getSession(), context.getRealm(), password);
        context.getAuthenticationSession().setAuthNote(PendingRegistration.NOTE_CREDENTIAL,
                PendingRegistration.encodeCredential(
                        new PendingRegistration.Credential(model.getCredentialData(), model.getSecretData())));
    }

    static PasswordCredentialModel hash(KeycloakSession session, RealmModel realm, String password) {
        PasswordPolicy policy = realm.getPasswordPolicy();
        // Same choice as Keycloak's password credential provider: the policy's algorithm when it
        // names one that exists, the default provider otherwise.
        PasswordHashProvider provider = null;
        if (policy != null && policy.getHashAlgorithm() != null) {
            provider = session.getProvider(PasswordHashProvider.class, policy.getHashAlgorithm());
        }
        if (provider == null) {
            provider = session.getProvider(PasswordHashProvider.class);
        }
        return provider.encodedCredential(password, policy == null ? -1 : policy.getHashIterations());
    }
}
