package co.fynk.keycloak.emailcode;

import java.util.Map;

/** Counters with a TTL, keyed by subject (a user id or a decoy key for unknown emails). */
public interface LimitStore {

    boolean putIfAbsent(String key, long lifespanSeconds);

    /** Null when absent. */
    Map<String, String> get(String key);

    void put(String key, long lifespanSeconds, Map<String, String> notes);

    boolean replace(String key, Map<String, String> notes);

    void remove(String key);
}
