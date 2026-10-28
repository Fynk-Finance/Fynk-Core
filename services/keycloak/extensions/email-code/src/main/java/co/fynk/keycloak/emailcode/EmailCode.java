package co.fynk.keycloak.emailcode;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.random.RandomGenerator;

/**
 * A 6-digit code bound to one authentication session. Only a salted hash is stored,
 * as one note string: {@code v1.<salt>.<hash>.<expiresAtEpochSeconds>.<attempts>}.
 */
public final class EmailCode {

    public static final int MAX_ATTEMPTS = 5;
    private static final String VERSION = "v1";
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private EmailCode() {
    }

    public enum Outcome { OK, WRONG, EXPIRED, EXHAUSTED, MALFORMED_INPUT, INVALID_NOTE }

    /** The plain code goes only into the email; {@code note} is what gets stored. */
    public record Issued(String code, String note) {
        @Override
        public String toString() {
            return "Issued[redacted]";
        }
    }

    /** {@code updatedNote} is null when the stored note must be removed. */
    public record Check(Outcome outcome, int attemptsLeft, String updatedNote) {
        @Override
        public String toString() {
            return "Check[" + outcome + ", attemptsLeft=" + attemptsLeft + "]";
        }
    }

    public static Issued issue(RandomGenerator random, Instant now, Duration lifetime) {
        String code = String.format("%06d", random.nextInt(1_000_000));
        byte[] salt = new byte[16];
        for (int i = 0; i < salt.length; i++) {
            salt[i] = (byte) random.nextInt(256);
        }
        long expiresAt = now.plus(lifetime).getEpochSecond();
        return new Issued(code, build(salt, hash(salt, code), expiresAt, 0));
    }

    /** True when the note is well formed, not expired and still has attempts left. */
    public static boolean isUsable(String note, Instant now) {
        Parsed p = Parsed.parse(note);
        return p != null && now.getEpochSecond() < p.expiresAt && p.attempts < MAX_ATTEMPTS;
    }

    public static Check verify(String note, String input, Instant now) {
        return verify(note, input, now, true);
    }

    /**
     * @param acceptMatch false for a decoy code: a matching input is counted as a wrong one, so
     *                    even a lucky guess of the random code never succeeds
     */
    public static Check verify(String note, String input, Instant now, boolean acceptMatch) {
        Parsed p = Parsed.parse(note);
        if (p == null) {
            return new Check(Outcome.INVALID_NOTE, 0, null);
        }
        String code = input == null ? "" : input.trim();
        if (!isSixDigits(code)) {
            return new Check(Outcome.MALFORMED_INPUT, Math.max(0, MAX_ATTEMPTS - p.attempts), note);
        }
        if (now.getEpochSecond() >= p.expiresAt) {
            return new Check(Outcome.EXPIRED, 0, null);
        }
        if (p.attempts >= MAX_ATTEMPTS) {
            return new Check(Outcome.EXHAUSTED, 0, null);
        }
        if (MessageDigest.isEqual(hash(p.salt, code), p.hash) && acceptMatch) {
            return new Check(Outcome.OK, MAX_ATTEMPTS - p.attempts, null);
        }
        int attempts = p.attempts + 1;
        int left = MAX_ATTEMPTS - attempts;
        String updated = left == 0 ? null : build(p.salt, p.hash, p.expiresAt, attempts);
        return new Check(Outcome.WRONG, left, updated);
    }

    private static boolean isSixDigits(String s) {
        if (s.length() != 6) {
            return false;
        }
        for (int i = 0; i < 6; i++) {
            char c = s.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return true;
    }

    private static byte[] hash(byte[] salt, String code) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt);
            return md.digest(code.getBytes(StandardCharsets.US_ASCII));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String build(byte[] salt, byte[] hash, long expiresAt, int attempts) {
        return String.join(".", VERSION, B64.encodeToString(salt), B64.encodeToString(hash),
                Long.toString(expiresAt), Integer.toString(attempts));
    }

    private record Parsed(byte[] salt, byte[] hash, long expiresAt, int attempts) {
        static Parsed parse(String note) {
            if (note == null) {
                return null;
            }
            String[] parts = note.split("\\.", -1);
            if (parts.length != 5 || !VERSION.equals(parts[0])) {
                return null;
            }
            try {
                byte[] salt = B64D.decode(parts[1]);
                byte[] hash = B64D.decode(parts[2]);
                long expiresAt = Long.parseLong(parts[3]);
                int attempts = Integer.parseInt(parts[4]);
                if (salt.length != 16 || hash.length != 32 || attempts < 0) {
                    return null;
                }
                return new Parsed(salt, hash, expiresAt, attempts);
            } catch (IllegalArgumentException e) { // bad base64 or number
                return null;
            }
        }

        @Override
        public String toString() {
            return "Parsed[redacted]";
        }
    }
}
