package co.fynk.keycloak.emailcode;

import jakarta.ws.rs.core.MultivaluedMap;
import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.forms.RegistrationPage;
import org.keycloak.authentication.forms.RegistrationPassword;
import org.keycloak.credential.hash.PasswordHashProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.PasswordPolicy;
import org.keycloak.models.RealmModel;
import org.keycloak.models.credential.PasswordCredentialModel;

/**
 * The registration form's password step, without a user to store it on. It keeps Keycloak's
 * checks and page. It remembers only a hash made with the realm's password policy, never the
 * plain password.
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
    public void success(FormContext context) {
        MultivaluedMap<String, String> formData = context.getHttpRequest().getDecodedFormParameters();
        String password = formData.getFirst(RegistrationPage.FIELD_PASSWORD);
        if (password == null || password.isEmpty()) {
            // No password on the form (Keycloak's hidden-password mode): the user sets it later.
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
