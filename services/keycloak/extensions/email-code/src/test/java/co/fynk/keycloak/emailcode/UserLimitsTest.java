package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.*;

import co.fynk.keycloak.emailcode.UserLimits.Purpose;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class UserLimitsTest {

    private static final Instant START = Instant.parse("2026-11-01T12:00:00Z");

    private Instant now;
    private UserLimits limits;

    @BeforeEach
    void setUp() {
        now = START;
        Clock clock = new Clock() {
            @Override
            public ZoneId getZone() {
                return ZoneOffset.UTC;
            }

            @Override
            public Clock withZone(ZoneId zone) {
                return this;
            }

            @Override
            public Instant instant() {
                return now;
            }
        };
        limits = new UserLimits(new FakeLimitStore(clock), clock);
    }

    private void advance(long seconds) {
        now = now.plus(Duration.ofSeconds(seconds));
    }

    private void fail(int times, Purpose p, String s) {
        for (int i = 0; i < times; i++) {
            limits.recordFailure(p, s);
        }
    }

    @Test
    void cooldownBlocksThenReleases() {
        assertTrue(limits.tryStartSend(Purpose.VERIFY, "u1"));
        advance(30);
        assertFalse(limits.tryStartSend(Purpose.VERIFY, "u1"));
        advance(29);
        assertFalse(limits.tryStartSend(Purpose.VERIFY, "u1"));
        advance(1);
        assertTrue(limits.tryStartSend(Purpose.VERIFY, "u1"));
    }

    @Test
    void cooldownSecondsCountDown() {
        assertEquals(0, limits.cooldownSecondsLeft(Purpose.VERIFY, "u1"));
        limits.tryStartSend(Purpose.VERIFY, "u1");
        assertEquals(60, limits.cooldownSecondsLeft(Purpose.VERIFY, "u1"));
        advance(45);
        assertEquals(15, limits.cooldownSecondsLeft(Purpose.VERIFY, "u1"));
        advance(15);
        assertEquals(0, limits.cooldownSecondsLeft(Purpose.VERIFY, "u1"));
    }

    @Test
    void budgetExhaustedOnTenthFailure() {
        fail(9, Purpose.VERIFY, "u1");
        assertFalse(limits.budgetExhausted(Purpose.VERIFY, "u1"));
        fail(1, Purpose.VERIFY, "u1");
        assertTrue(limits.budgetExhausted(Purpose.VERIFY, "u1"));
    }

    @Test
    void exhaustionEndsTwelveHoursAfterFirstFailure() {
        fail(1, Purpose.RESET, "u1");
        advance(11 * 3600);
        fail(9, Purpose.RESET, "u1");
        assertTrue(limits.budgetExhausted(Purpose.RESET, "u1"));
        advance(3600 - 1);
        assertTrue(limits.budgetExhausted(Purpose.RESET, "u1"));
        advance(1);
        assertFalse(limits.budgetExhausted(Purpose.RESET, "u1"));
    }

    @Test
    void windowDoesNotSlide() {
        fail(1, Purpose.VERIFY, "u1");
        advance(11 * 3600 + 59 * 60);
        fail(1, Purpose.VERIFY, "u1"); // a late failure must not extend the window
        advance(60);
        fail(9, Purpose.VERIFY, "u1"); // new window: 9 failures only
        assertFalse(limits.budgetExhausted(Purpose.VERIFY, "u1"));
    }

    @Test
    void purposesAreIndependent() {
        fail(10, Purpose.VERIFY, "u1");
        assertTrue(limits.budgetExhausted(Purpose.VERIFY, "u1"));
        assertFalse(limits.budgetExhausted(Purpose.RESET, "u1"));
        limits.tryStartSend(Purpose.VERIFY, "u1");
        assertTrue(limits.tryStartSend(Purpose.RESET, "u1"));
    }

    @Test
    void subjectsAreIndependent() {
        fail(10, Purpose.VERIFY, "u1");
        assertFalse(limits.budgetExhausted(Purpose.VERIFY, "u2"));
        limits.tryStartSend(Purpose.VERIFY, "u1");
        assertTrue(limits.tryStartSend(Purpose.VERIFY, "u2"));
    }

    @Test
    void clearFailuresResets() {
        fail(10, Purpose.VERIFY, "u1");
        limits.clearFailures(Purpose.VERIFY, "u1");
        assertFalse(limits.budgetExhausted(Purpose.VERIFY, "u1"));
        fail(9, Purpose.VERIFY, "u1");
        assertFalse(limits.budgetExhausted(Purpose.VERIFY, "u1"));
    }
}
