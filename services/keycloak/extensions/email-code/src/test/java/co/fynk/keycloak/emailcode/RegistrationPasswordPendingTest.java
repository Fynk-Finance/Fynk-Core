package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.ValidationContext;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.http.HttpRequest;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.utils.FormMessage;
import org.keycloak.policy.PasswordPolicyManagerProvider;
import org.keycloak.policy.PolicyError;

/**
 * The live staging realm got the pending password step without its authenticator config. With
 * email verification on, Keycloak's step then hid the password fields and skipped every password
 * check. These tests run the step in that state: no config, verify email on.
 */
class RegistrationPasswordPendingTest {

    private final RegistrationPasswordPending step = new RegistrationPasswordPending();

    @Test
    void asksForThePasswordWithoutTheAuthenticatorConfig() {
        Map<String, Object> pageAttributes = new HashMap<>();

        step.buildPage(fake(FormContext.class, contextAnswers(new MultivaluedHashMap<>(), null)),
                fake(LoginFormsProvider.class, Map.of("setAttribute", args -> {
                    pageAttributes.put((String) args[0], args[1]);
                    return null;
                })));

        assertEquals(Boolean.TRUE, pageAttributes.get("passwordRequired"));
    }

    @Test
    void rejectsAMissingPasswordWithoutTheAuthenticatorConfig() {
        ValidationResult result = validate(form("ana@fynk.local", null, null), null);

        assertFalse(result.success);
        assertEquals("invalid_registration", result.error);
        assertEquals(List.of("password"), result.fields());
        assertEquals(List.of("missingPasswordMessage"), result.messages());
    }

    @Test
    void rejectsADifferentConfirmation() {
        ValidationResult result = validate(form("ana@fynk.local", "Clave-segura1", "Clave-segura2"), null);

        assertFalse(result.success);
        assertEquals(List.of("invalidPasswordConfirmMessage"), result.messages());
    }

    @Test
    void appliesTheRealmPasswordPolicy() {
        ValidationResult result = validate(form("ana@fynk.local", "corta", "corta"),
                new PolicyError("invalidPasswordMinLengthMessage", 12));

        assertFalse(result.success);
        assertEquals(List.of("invalidPasswordMinLengthMessage"), result.messages());
        assertNull(result.rejectedForm.getFirst("password"), "the password is not echoed back");
        assertNull(result.rejectedForm.getFirst("password-confirm"));
    }

    @Test
    void acceptsAMatchingPasswordThatMeetsThePolicy() {
        ValidationResult result = validate(form("ana@fynk.local", "Clave-segura1", "Clave-segura1"), null);

        assertTrue(result.success);
        assertNull(result.error);
    }

    // ---- fakes ----

    private static MultivaluedMap<String, String> form(String email, String password, String confirm) {
        MultivaluedMap<String, String> form = new MultivaluedHashMap<>();
        form.putSingle("email", email);
        if (password != null) {
            form.putSingle("password", password);
        }
        if (confirm != null) {
            form.putSingle("password-confirm", confirm);
        }
        return form;
    }

    private static final class ValidationResult {
        boolean success;
        String error;
        MultivaluedMap<String, String> rejectedForm;
        List<FormMessage> errors = List.of();

        List<String> fields() {
            return errors.stream().map(FormMessage::getField).toList();
        }

        List<String> messages() {
            return errors.stream().map(FormMessage::getMessage).toList();
        }
    }

    @SuppressWarnings("unchecked")
    private ValidationResult validate(MultivaluedMap<String, String> form, PolicyError policyError) {
        ValidationResult result = new ValidationResult();
        Map<String, Answer> answers = contextAnswers(form, policyError);
        answers.put("success", args -> {
            result.success = true;
            return null;
        });
        answers.put("error", args -> {
            result.error = (String) args[0];
            return null;
        });
        answers.put("validationError", args -> {
            result.rejectedForm = (MultivaluedMap<String, String>) args[0];
            result.errors = (List<FormMessage>) args[1];
            return null;
        });
        step.validate(fake(ValidationContext.class, answers));
        return result;
    }

    /** A context with no authenticator config, in a realm with email verification on. */
    private static Map<String, Answer> contextAnswers(MultivaluedMap<String, String> form, PolicyError policyError) {
        RealmModel realm = fake(RealmModel.class, Map.of(
                "isVerifyEmail", args -> true,
                "isRegistrationEmailAsUsername", args -> true));
        PasswordPolicyManagerProvider policy = fake(PasswordPolicyManagerProvider.class,
                Map.of("validate", args -> policyError));
        KeycloakSession session = fake(KeycloakSession.class, Map.of("getProvider", args -> policy));
        HttpRequest request = fake(HttpRequest.class, Map.of("getDecodedFormParameters", args -> form));
        Map<String, Answer> answers = new HashMap<>();
        answers.put("getAuthenticatorConfig", args -> null);
        answers.put("getRealm", args -> realm);
        answers.put("getSession", args -> session);
        answers.put("getHttpRequest", args -> request);
        answers.put("getEvent", args -> null);
        return answers;
    }

    @FunctionalInterface
    private interface Answer {
        Object answer(Object[] args);
    }

    private static <T> T fake(Class<T> type, Map<String, Answer> answers) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, method, args) -> {
            Answer answer = answers.get(method.getName());
            if (answer == null) {
                throw new UnsupportedOperationException(type.getSimpleName() + "." + method.getName());
            }
            return answer.answer(args == null ? new Object[0] : args);
        }));
    }
}
