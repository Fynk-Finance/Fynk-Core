package co.fynk.keycloak.emailcode;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.keycloak.email.EmailException;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.SubjectCredentialManager;
import org.keycloak.models.UserModel;
import org.keycloak.storage.adapter.AbstractInMemoryUserAdapter;
import org.keycloak.sessions.AuthenticationSessionModel;

/** Sends a code by email. It never logs the code or the address. */
public final class CodeMailer {

    public static final String TEMPLATE = "fynk-email-code.ftl";

    public enum Purpose {
        VERIFY("verify", "fynkEmailCodeSubjectVerify"),
        RESET("reset", "fynkEmailCodeSubjectReset");

        final String attribute;
        final String subjectKey;

        Purpose(String attribute, String subjectKey) {
            this.attribute = attribute;
            this.subjectKey = subjectKey;
        }
    }

    private CodeMailer() {
    }

    /** A user that exists only in memory, to give the email provider an address. */
    private static final class TransientUser extends AbstractInMemoryUserAdapter {
        TransientUser(KeycloakSession session, RealmModel realm, String email) {
            super(session, realm, "transient-" + UUID.randomUUID());
            setUsername(email);
            setEmail(email);
        }

        @Override
        public SubjectCredentialManager credentialManager() {
            throw new UnsupportedOperationException("A transient user has no credentials");
        }
    }

    /** Whole minutes the code lives, rounded up. */
    public static long minutes(long lifespanSeconds) {
        return (lifespanSeconds + 59) / 60;
    }

    /**
     * Sends to an address that has no stored user yet (a sign-up waiting for its code). A
     * transient in-memory user carries the address; nothing is persisted.
     */
    public static boolean sendToAddress(KeycloakSession session, RealmModel realm, String email,
                                        AuthenticationSessionModel authSession, Purpose purpose,
                                        String code, long lifespanSeconds) {
        return send(session, realm, new TransientUser(session, realm, email), authSession, purpose, code, lifespanSeconds);
    }

    /** @return false when the mail server refused the message (the reason is not logged). */
    public static boolean send(KeycloakSession session, RealmModel realm, UserModel user,
                               AuthenticationSessionModel authSession, Purpose purpose,
                               String code, long lifespanSeconds) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("code", code);
        attributes.put("minutes", minutes(lifespanSeconds));
        attributes.put("purpose", purpose.attribute);
        try {
            session.getProvider(EmailTemplateProvider.class)
                    .setRealm(realm)
                    .setUser(user)
                    .setAuthenticationSession(authSession)
                    .send(purpose.subjectKey, List.of(), TEMPLATE, attributes);
            return true;
        } catch (EmailException e) {
            return false;
        }
    }
}
