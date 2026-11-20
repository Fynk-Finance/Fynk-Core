package co.fynk.keycloak.emailcode;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The pieces of a sign-up that waits for its email code. They live only in the browser's
 * authentication session (auth notes) until the right code creates the user. This class only
 * encodes and decodes them, so it needs no Keycloak and is easy to test. It never logs.
 */
public final class PendingRegistration {

    /** Validated profile attributes, without any password field. */
    public static final String NOTE_PROFILE = "fynk.registration.profile";
    /** The password hash made with the realm policy (credential data and secret data). */
    public static final String NOTE_CREDENTIAL = "fynk.registration.credential";
    /** Epoch seconds of the terms acceptance. */
    public static final String NOTE_TERMS = "fynk.registration.terms";
    /** The code note, same format as {@code VerifyEmailWithCode}. */
    public static final String NOTE_CODE = "fynk.registration.code";
    /** The limits subject (an address hash, never the address) the code was sent for. */
    public static final String NOTE_CODE_SUBJECT = "fynk.registration.code.subject";

    public static final List<String> ALL_NOTES =
            List.of(NOTE_PROFILE, NOTE_CREDENTIAL, NOTE_TERMS, NOTE_CODE, NOTE_CODE_SUBJECT);

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private PendingRegistration() {
    }

    /** Attributes as {@code name=value&name=value}, URL encoded. A name may repeat for many values. */
    public static String encodeProfile(Map<String, List<String>> attributes) {
        StringBuilder out = new StringBuilder();
        attributes.forEach((name, values) -> {
            if (values == null) {
                return;
            }
            for (String value : values) {
                if (out.length() > 0) {
                    out.append('&');
                }
                out.append(enc(name)).append('=').append(enc(value == null ? "" : value));
            }
        });
        return out.toString();
    }

    /** @return the attributes, or null when the note is missing, empty or damaged. */
    public static Map<String, List<String>> decodeProfile(String note) {
        if (note == null || note.isEmpty()) {
            return null;
        }
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (String pair : note.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) {
                return null;
            }
            out.computeIfAbsent(dec(pair.substring(0, eq)), k -> new ArrayList<>()).add(dec(pair.substring(eq + 1)));
        }
        return out;
    }

    /** The email of a decoded profile, or null. */
    public static String email(Map<String, List<String>> profile) {
        if (profile == null) {
            return null;
        }
        List<String> values = profile.get("email");
        if (values == null || values.isEmpty() || values.get(0).isBlank()) {
            return null;
        }
        return values.get(0);
    }

    /** Credential data and secret data, which hold the hash and never the plain password. */
    public record Credential(String credentialData, String secretData) {
        @Override
        public String toString() {
            return "Credential[redacted]";
        }
    }

    public static String encodeCredential(Credential credential) {
        return b64(credential.credentialData()) + "." + b64(credential.secretData());
    }

    /** @return the credential, or null when the note is missing or damaged. */
    public static Credential decodeCredential(String note) {
        if (note == null) {
            return null;
        }
        String[] parts = note.split("\\.", -1);
        if (parts.length != 2) {
            return null;
        }
        try {
            return new Credential(
                    new String(B64D.decode(parts[0]), StandardCharsets.UTF_8),
                    new String(B64D.decode(parts[1]), StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * The limits subject of a person who has no user yet: a hash of the realm and the lowercased
     * address, so the raw address never becomes part of a key.
     */
    public static String limitsSubject(String realmId, String email) {
        return "reg:" + sha256Hex(realmId + ":" + email.toLowerCase(Locale.ROOT));
    }

    /**
     * True only when the code was issued for this very address. A code that has no recorded
     * subject, or one for another address, must never verify the pending sign-up.
     */
    public static boolean codeBelongsTo(String storedSubject, String currentSubject) {
        return storedSubject != null && currentSubject != null
                && MessageDigest.isEqual(
                        storedSubject.getBytes(StandardCharsets.UTF_8),
                        currentSubject.getBytes(StandardCharsets.UTF_8));
    }

    static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String b64(String s) {
        return B64.encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String dec(String s) {
        return URLDecoder.decode(s, StandardCharsets.UTF_8);
    }
}
