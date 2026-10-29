package co.fynk.keycloak.emailcode;

import java.time.Instant;
import org.keycloak.models.UserModel;

/**
 * The time a person last proved they own the mailbox by resetting the password with the email
 * code. The backend reads it (admin API) to allow the backup reset ("No tengo ninguno de los
 * dos") only right after such a reset. Nothing else writes it: not the registration code, not
 * the app's "Cambiar contraseña", which needs only the password.
 *
 * <p>The attribute is unmanaged. With {@code unmanagedAttributePolicy: ADMIN_VIEW} the person
 * can neither see nor change it in the account console, the account API or the login forms.
 */
public final class ResetStamp {

    /** Attribute name, no dots so it is safe in every Keycloak API. */
    public static final String ATTRIBUTE = "fynkEmailResetAt";

    private ResetStamp() {
    }

    /** Epoch milliseconds as a string, the format the backend parses. */
    public static String format(Instant now) {
        return Long.toString(now.toEpochMilli());
    }

    /** Records that {@code user} proved the mailbox at {@code now}, replacing any older value. */
    public static void stamp(UserModel user, Instant now) {
        user.setSingleAttribute(ATTRIBUTE, format(now));
    }
}
