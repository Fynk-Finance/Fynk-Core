package co.fynk.keycloak.emailcode;

import jakarta.ws.rs.core.MultivaluedMap;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.AuthenticationFlowException;
import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.forms.RegistrationUserCreation;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.services.messages.Messages;
import org.keycloak.userprofile.UserProfile;

/**
 * The registration form's user step, without creating the user. It keeps Keycloak's checks (email
 * format, email in use, user profile) and only remembers the validated attributes in the
 * authentication session. {@link RegistrationEmailCode} creates the user after the right code.
 */
public class RegistrationUserPending extends RegistrationUserCreation {

    public static final String ID = "fynk-registration-user-pending";

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public String getDisplayType() {
        return "Registration user checks (user created after the email code)";
    }

    @Override
    public String getHelpText() {
        return "Validates the user profile like the Keycloak step, but creates no user. The attributes wait in the authentication session for the email code.";
    }

    @Override
    public void success(FormContext context) {
        if (context.getUser() != null) {
            // Back navigation into a strange state, same guard as Keycloak's step.
            throw new AuthenticationFlowException(AuthenticationFlowError.GENERIC_AUTHENTICATION_ERROR,
                    Errors.DIFFERENT_USER_AUTHENTICATING, Messages.EXPIRED_ACTION);
        }
        MultivaluedMap<String, String> formData = context.getHttpRequest().getDecodedFormParameters();
        UserProfile profile = getOrCreateUserProfile(context, formData);
        Map<String, List<String>> attributes = new LinkedHashMap<>();
        profile.getAttributes().getWritable().forEach((name, values) -> {
            if (values != null && !values.isEmpty()) {
                attributes.put(name, new ArrayList<>(values));
            }
        });
        if (context.getRealm().isRegistrationEmailAsUsername()) {
            attributes.put("username", List.of(profile.getAttributes().getFirst("email")));
        }
        // A new pending sign-up starts clean: a code, a hash or a terms time of an earlier try
        // (maybe for another address) must not carry over.
        for (String note : PendingRegistration.ALL_NOTES) {
            context.getAuthenticationSession().removeAuthNote(note);
        }
        context.getAuthenticationSession().setAuthNote(PendingRegistration.NOTE_PROFILE,
                PendingRegistration.encodeProfile(attributes));
        context.getEvent().detail(Details.REGISTER_METHOD, "form")
                .removeDetail(Details.EMAIL)
                .removeDetail(Details.USERNAME);
    }
}
