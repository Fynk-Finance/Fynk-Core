package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.*;

import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.VerifyDecision.Kind;
import co.fynk.keycloak.emailcode.VerifyDecision.Reaction;
import co.fynk.keycloak.emailcode.VerifyDecision.Send;
import java.time.Duration;
import java.time.Instant;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class VerifyDecisionTest {

    private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");

    private static Issued issued() {
        return EmailCode.issue(new Random(3), NOW, Duration.ofMinutes(10));
    }

    private static String wrong(String code) {
        return code.equals("123456") ? "654321" : "123456";
    }

    @Test
    void challengeWithExhaustedBudgetNeverSendsNorStartsCooldown() {
        AtomicInteger calls = new AtomicInteger();
        Send s = VerifyDecision.onChallenge(true, false, () -> {
            calls.incrementAndGet();
            return true;
        });
        assertEquals(Send.BUDGET_EXHAUSTED, s);
        assertEquals(0, calls.get());
    }

    @Test
    void challengeWithUsableNoteShowsFormWithoutStartingCooldown() {
        AtomicInteger calls = new AtomicInteger();
        Send s = VerifyDecision.onChallenge(false, true, () -> {
            calls.incrementAndGet();
            return true;
        });
        assertEquals(Send.FORM, s);
        assertEquals(0, calls.get());
    }

    @Test
    void challengeWithoutNoteSendsWhenCooldownAllows() {
        assertEquals(Send.SEND, VerifyDecision.onChallenge(false, false, () -> true));
    }

    @Test
    void challengeWithoutNoteWaitsWhenCooldownBlocks() {
        assertEquals(Send.WAIT, VerifyDecision.onChallenge(false, false, () -> false));
    }

    @Test
    void resendSendsOnlyWhenCooldownAllows() {
        assertEquals(Send.SEND, VerifyDecision.onResend(false, () -> true));
        assertEquals(Send.WAIT, VerifyDecision.onResend(false, () -> false));
    }

    @Test
    void resendWithExhaustedBudgetIsRefused() {
        assertEquals(Send.BUDGET_EXHAUSTED, VerifyDecision.onResend(true, () -> true));
    }

    @Test
    void rightCodeVerifies() {
        Issued i = issued();
        Reaction r = VerifyDecision.afterCheck(EmailCode.verify(i.note(), i.code(), NOW));
        assertEquals(Kind.VERIFIED, r.kind());
        assertNull(r.errorEvent());
        assertFalse(r.recordFailure());
    }

    @Test
    void wrongCodeCountsAFailureAndKeepsTheNote() {
        Issued i = issued();
        Reaction r = VerifyDecision.afterCheck(EmailCode.verify(i.note(), wrong(i.code()), NOW));
        assertEquals(Kind.WRONG, r.kind());
        assertEquals("invalid_code", r.errorEvent());
        assertTrue(r.recordFailure());
        assertFalse(r.removeNote());
    }

    @Test
    void lastWrongAttemptAsksForANewCodeAndCountsAFailure() {
        Issued i = issued();
        String note = i.note();
        Check c = null;
        for (int n = 0; n < EmailCode.MAX_ATTEMPTS; n++) {
            c = EmailCode.verify(note, wrong(i.code()), NOW);
            note = c.updatedNote();
        }
        Reaction r = VerifyDecision.afterCheck(c);
        assertEquals(Kind.REQUEST_NEW, r.kind());
        assertEquals("invalid_code", r.errorEvent());
        assertTrue(r.recordFailure());
        assertTrue(r.removeNote());
    }

    @Test
    void expiredCodeAsksForANewOneWithoutCountingAFailure() {
        Issued i = issued();
        Reaction r = VerifyDecision.afterCheck(EmailCode.verify(i.note(), i.code(), NOW.plus(Duration.ofMinutes(11))));
        assertEquals(Kind.REQUEST_NEW, r.kind());
        assertEquals("expired_code", r.errorEvent());
        assertFalse(r.recordFailure());
        assertTrue(r.removeNote());
    }

    @Test
    void missingNoteAsksForANewCode() {
        Reaction r = VerifyDecision.afterCheck(EmailCode.verify(null, "123456", NOW));
        assertEquals(Kind.REQUEST_NEW, r.kind());
        assertEquals("invalid_code", r.errorEvent());
        assertFalse(r.recordFailure());
    }

    @Test
    void malformedInputCountsNothingAndKeepsTheNote() {
        Issued i = issued();
        Reaction r = VerifyDecision.afterCheck(EmailCode.verify(i.note(), "12ab", NOW));
        assertEquals(Kind.MALFORMED, r.kind());
        assertNull(r.errorEvent());
        assertFalse(r.recordFailure());
        assertFalse(r.removeNote());
    }

    @Test
    void usableNoteIsFalseWhenMissingExpiredOrSpent() {
        Issued i = issued();
        assertTrue(EmailCode.isUsable(i.note(), NOW));
        assertFalse(EmailCode.isUsable(null, NOW));
        assertFalse(EmailCode.isUsable("junk", NOW));
        assertFalse(EmailCode.isUsable(i.note(), NOW.plus(Duration.ofMinutes(10))));
        String note = i.note();
        for (int n = 0; n < EmailCode.MAX_ATTEMPTS - 1; n++) {
            note = EmailCode.verify(note, wrong(i.code()), NOW).updatedNote();
        }
        assertTrue(EmailCode.isUsable(note, NOW));
    }

    @Test
    void minutesRoundUp() {
        assertEquals(10, CodeMailer.minutes(600));
        assertEquals(1, CodeMailer.minutes(1));
        assertEquals(2, CodeMailer.minutes(61));
    }
}
