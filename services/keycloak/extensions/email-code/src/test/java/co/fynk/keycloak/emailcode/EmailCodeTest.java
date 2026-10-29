package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.*;

import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.EmailCode.Outcome;
import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import java.util.random.RandomGenerator;
import org.junit.jupiter.api.Test;

class EmailCodeTest {

    private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");
    private static final Duration LIFETIME = Duration.ofMinutes(10);

    private static Issued issued() {
        return EmailCode.issue(new Random(7), NOW, LIFETIME);
    }

    private static String wrongCode(String code) {
        return code.equals("123456") ? "654321" : "123456";
    }

    @Test
    void issueProducesSixDigits() {
        assertTrue(issued().code().matches("\\d{6}"));
    }

    @Test
    void issueZeroPads() {
        RandomGenerator stub = new Random() {
            @Override
            public int nextInt(int bound) {
                return bound == 1_000_000 ? 42 : 1;
            }
        };
        assertEquals("000042", EmailCode.issue(stub, NOW, LIFETIME).code());
    }

    @Test
    void noteFormat() {
        Issued i = issued();
        String[] parts = i.note().split("\\.");
        assertEquals(5, parts.length);
        assertEquals("v1", parts[0]);
        assertEquals(Long.toString(NOW.plus(LIFETIME).getEpochSecond()), parts[3]);
        assertEquals("0", parts[4]);
        assertFalse(i.note().contains(i.code()));
        assertFalse(i.toString().contains(i.code()));
    }

    @Test
    void rightCodeIsOkAndRemovesNote() {
        Issued i = issued();
        Check c = EmailCode.verify(i.note(), i.code(), NOW.plusSeconds(5));
        assertEquals(Outcome.OK, c.outcome());
        assertNull(c.updatedNote());
    }

    @Test
    void whitespaceAroundRightCodeIsOk() {
        Issued i = issued();
        assertEquals(Outcome.OK, EmailCode.verify(i.note(), " " + i.code() + "\n", NOW).outcome());
    }

    @Test
    void wrongCodeCountsAnAttempt() {
        Issued i = issued();
        Check c = EmailCode.verify(i.note(), wrongCode(i.code()), NOW);
        assertEquals(Outcome.WRONG, c.outcome());
        assertEquals(4, c.attemptsLeft());
        assertNotNull(c.updatedNote());
        assertTrue(c.updatedNote().endsWith(".1"));
    }

    @Test
    void fiveWrongThenRightCodeIsRefused() {
        Issued i = issued();
        String note = i.note();
        Check c = null;
        for (int n = 0; n < 5; n++) {
            c = EmailCode.verify(note, wrongCode(i.code()), NOW);
            assertEquals(Outcome.WRONG, c.outcome());
            note = c.updatedNote();
        }
        assertEquals(0, c.attemptsLeft());
        assertNull(note);
        assertNotEquals(Outcome.OK, EmailCode.verify(note, i.code(), NOW).outcome());
    }

    @Test
    void exhaustedNoteRefusesRightCode() {
        Issued i = issued();
        String[] p = i.note().split("\\.");
        String note = String.join(".", p[0], p[1], p[2], p[3], "5");
        Check c = EmailCode.verify(note, i.code(), NOW);
        assertEquals(Outcome.EXHAUSTED, c.outcome());
        assertNull(c.updatedNote());
    }

    @Test
    void expired() {
        Issued i = issued();
        Check c = EmailCode.verify(i.note(), i.code(), NOW.plus(LIFETIME));
        assertEquals(Outcome.EXPIRED, c.outcome());
        assertNull(c.updatedNote());
    }

    @Test
    void malformedInputKeepsNoteAndAttempts() {
        Issued i = issued();
        for (String in : new String[] {"12a456", "12345", "1234567", "", null, "12 456", "１２３４５６"}) {
            Check c = EmailCode.verify(i.note(), in, NOW);
            assertEquals(Outcome.MALFORMED_INPUT, c.outcome(), String.valueOf(in));
            assertEquals(i.note(), c.updatedNote());
            assertEquals(5, c.attemptsLeft());
        }
    }

    @Test
    void tamperedNoteIsInvalid() {
        Issued i = issued();
        String[] p = i.note().split("\\.");
        String[] bad = {
            String.join(".", p[0], p[1], "AAAA", p[3], p[4]),
            String.join(".", p[0], p[1], p[2], p[3], "-1"),
            "garbage",
            "",
            null,
            "v2." + i.note().substring(3),
            i.note() + ".extra",
        };
        for (String note : bad) {
            assertEquals(Outcome.INVALID_NOTE, EmailCode.verify(note, i.code(), NOW).outcome(), String.valueOf(note));
        }
    }
}
