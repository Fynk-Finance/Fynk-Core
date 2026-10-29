package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.*;

import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.VerifyDecision.Kind;
import co.fynk.keycloak.emailcode.VerifyDecision.Reaction;
import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import org.junit.jupiter.api.Test;

class ResetDecisionTest {

    private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");

    private static Issued issued() {
        return EmailCode.issue(new Random(11), NOW, Duration.ofMinutes(10));
    }

    private static String wrong(String code) {
        return code.equals("123456") ? "654321" : "123456";
    }

    @Test
    void decoySubjectIsStableAndIgnoresCaseAndSpaces() {
        String a = ResetDecision.decoySubject("realm-1", "Ana@Example.com");
        assertEquals(a, ResetDecision.decoySubject("realm-1", "  ana@example.com "));
        assertTrue(a.startsWith("decoy-"));
        assertEquals("decoy-".length() + 64, a.length());
    }

    @Test
    void decoySubjectDependsOnTheRealmAndTheAddressAndHidesTheAddress() {
        String a = ResetDecision.decoySubject("realm-1", "ana@example.com");
        assertNotEquals(a, ResetDecision.decoySubject("realm-2", "ana@example.com"));
        assertNotEquals(a, ResetDecision.decoySubject("realm-1", "ben@example.com"));
        assertFalse(a.contains("ana"));
    }

    @Test
    void decoyAndRealGiveTheSameReactionForTheSameWrongInputs() {
        Issued i = issued();
        String realNote = i.note();
        String decoyNote = i.note();
        for (String input : new String[] {wrong(i.code()), "abc", "", null, "12345"}) {
            Check real = ResetDecision.check(realNote, input, NOW, false);
            Check decoy = ResetDecision.check(decoyNote, input, NOW, true);
            assertEquals(real, decoy);
            assertEquals(VerifyDecision.afterCheck(real), VerifyDecision.afterCheck(decoy));
            realNote = real.updatedNote();
            decoyNote = decoy.updatedNote();
        }
    }

    @Test
    void aCorrectCodeForARealUserVerifies() {
        Issued i = issued();
        Reaction r = VerifyDecision.afterCheck(ResetDecision.check(i.note(), i.code(), NOW, false));
        assertEquals(Kind.VERIFIED, r.kind());
    }

    @Test
    void aCorrectCodeWithoutAUserBehavesLikeAWrongCode() {
        Issued i = issued();
        Check decoy = ResetDecision.check(i.note(), i.code(), NOW, true);
        Check wrongOnReal = ResetDecision.check(i.note(), wrong(i.code()), NOW, false);
        assertEquals(wrongOnReal, decoy);
        Reaction r = VerifyDecision.afterCheck(decoy);
        assertNotEquals(Kind.VERIFIED, r.kind());
        assertEquals(Kind.WRONG, r.kind());
        assertTrue(r.recordFailure());
        assertEquals("invalid_code", r.errorEvent());
    }

    @Test
    void aDecoyNeverVerifiesEvenOnTheLastAttempts() {
        Issued i = issued();
        String note = i.note();
        for (int n = 0; n < EmailCode.MAX_ATTEMPTS; n++) {
            Check c = ResetDecision.check(note, i.code(), NOW, true);
            assertNotEquals(Kind.VERIFIED, VerifyDecision.afterCheck(c).kind());
            note = c.updatedNote();
        }
        assertNull(note, "after 5 attempts the note is gone, like on a real account");
    }
}
