package co.fynk.keycloak.emailcode;

import co.fynk.keycloak.emailcode.EmailCode.Check;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Pure decisions of the reset-by-code authenticator. A real account and a decoy (an email that
 * has no account) go through the same rules, so the person at the keyboard sees no difference.
 */
public final class ResetDecision {

    private ResetDecision() {
    }

    /**
     * Limits subject of an email that has no account: {@code decoy-} plus the SHA-256 of the realm
     * and the lowercased, trimmed address. The address itself is never stored.
     */
    public static String decoySubject(String realmId, String attemptedEmail) {
        String normalized = attemptedEmail == null ? "" : attemptedEmail.trim().toLowerCase(Locale.ROOT);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((realmId + ":" + normalized).getBytes(StandardCharsets.UTF_8));
            return "decoy-" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Checks the typed code. For a decoy a correct code counts as a wrong one. */
    public static Check check(String note, String input, Instant now, boolean decoy) {
        return EmailCode.verify(note, input, now, !decoy);
    }
}
