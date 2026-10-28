package co.fynk.keycloak.emailcode;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/** In-memory store that honors lifespans against the given clock. */
final class FakeLimitStore implements LimitStore {

    private record Entry(long expiresAt, Map<String, String> notes) { }

    private final Clock clock;
    private final Map<String, Entry> entries = new HashMap<>();

    FakeLimitStore(Clock clock) {
        this.clock = clock;
    }

    private Entry live(String key) {
        Entry e = entries.get(key);
        if (e != null && clock.instant().getEpochSecond() >= e.expiresAt) {
            entries.remove(key);
            return null;
        }
        return e;
    }

    @Override
    public boolean putIfAbsent(String key, long lifespanSeconds) {
        if (live(key) != null) {
            return false;
        }
        put(key, lifespanSeconds, Map.of());
        return true;
    }

    @Override
    public Map<String, String> get(String key) {
        Entry e = live(key);
        return e == null ? null : e.notes;
    }

    @Override
    public void put(String key, long lifespanSeconds, Map<String, String> notes) {
        entries.put(key, new Entry(clock.instant().getEpochSecond() + lifespanSeconds, Map.copyOf(notes)));
    }

    @Override
    public boolean replace(String key, Map<String, String> notes) {
        Entry e = live(key);
        if (e == null) {
            return false;
        }
        entries.put(key, new Entry(e.expiresAt, Map.copyOf(notes)));
        return true;
    }

    @Override
    public void remove(String key) {
        entries.remove(key);
    }
}
