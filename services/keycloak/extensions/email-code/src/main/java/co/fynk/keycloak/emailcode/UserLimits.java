package co.fynk.keycloak.emailcode;

import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;

/** Resend cooldown and wrong-code budget per subject and purpose. Never logs. */
public final class UserLimits {

    public static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    public static final int FAILURE_BUDGET = 10;
    public static final Duration FAILURE_WINDOW = Duration.ofHours(12);

    public enum Purpose { VERIFY, RESET }

    private final LimitStore store;
    private final Clock clock;

    public UserLimits(LimitStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    /** True and starts the cooldown when none is running. */
    public boolean tryStartSend(Purpose purpose, String subject) {
        String key = cooldownKey(purpose, subject);
        long secs = RESEND_COOLDOWN.getSeconds();
        if (!store.putIfAbsent(key, secs)) {
            return false;
        }
        // put (not replace) so the 60 s lifespan is certain while the end time is recorded.
        store.put(key, secs, Map.of("end", Long.toString(now() + secs)));
        return true;
    }

    public long cooldownSecondsLeft(Purpose purpose, String subject) {
        Map<String, String> notes = store.get(cooldownKey(purpose, subject));
        if (notes == null) {
            return 0;
        }
        Long end = parse(notes.get("end"));
        return end == null ? 0 : Math.max(0, end - now());
    }

    public void recordFailure(Purpose purpose, String subject) {
        String key = failuresKey(purpose, subject);
        Map<String, String> notes = store.get(key);
        long count = 0;
        long windowEnd = now() + FAILURE_WINDOW.getSeconds();
        if (notes != null) {
            Long c = parse(notes.get("count"));
            Long w = parse(notes.get("windowEnd"));
            if (c != null && w != null && w > now()) {
                count = c;
                windowEnd = w; // the window never slides
            }
        }
        // put with the remaining lifespan, so this does not depend on replace keeping it.
        store.put(key, Math.max(1, windowEnd - now()), Map.of(
                "count", Long.toString(count + 1),
                "windowEnd", Long.toString(windowEnd)));
    }

    public boolean budgetExhausted(Purpose purpose, String subject) {
        Map<String, String> notes = store.get(failuresKey(purpose, subject));
        if (notes == null) {
            return false;
        }
        Long count = parse(notes.get("count"));
        Long windowEnd = parse(notes.get("windowEnd"));
        return count != null && windowEnd != null && count >= FAILURE_BUDGET && windowEnd > now();
    }

    public void clearFailures(Purpose purpose, String subject) {
        store.remove(failuresKey(purpose, subject));
    }

    private long now() {
        return clock.instant().getEpochSecond();
    }

    private static Long parse(String s) {
        try {
            return s == null ? null : Long.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cooldownKey(Purpose p, String subject) {
        return "fynk-email-code-cooldown-" + p.name().toLowerCase(Locale.ROOT) + "-" + subject;
    }

    private static String failuresKey(Purpose p, String subject) {
        return "fynk-email-code-failures-" + p.name().toLowerCase(Locale.ROOT) + "-" + subject;
    }
}
