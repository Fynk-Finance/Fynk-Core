package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.*;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.keycloak.models.UserModel;

class ResetStampTest {

    private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");

    /** A UserModel that only keeps single attributes. */
    private static UserModel user(Map<String, String> store) {
        return (UserModel) Proxy.newProxyInstance(UserModel.class.getClassLoader(), new Class<?>[] {UserModel.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("setSingleAttribute")) {
                        store.put((String) args[0], (String) args[1]);
                        return null;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }

    @Test
    void theNameHasNoDots() {
        assertEquals("fynkEmailResetAt", ResetStamp.ATTRIBUTE);
    }

    @Test
    void formatIsEpochMilliseconds() {
        assertEquals("1793534400000", ResetStamp.format(NOW));
        assertEquals("1793534400123", ResetStamp.format(NOW.plusMillis(123)));
    }

    @Test
    void stampWritesOnlyThatAttributeAndReplacesTheOldValue() {
        Map<String, String> store = new HashMap<>();
        UserModel u = user(store);
        ResetStamp.stamp(u, NOW);
        ResetStamp.stamp(u, NOW.plusSeconds(60));
        assertEquals(Map.of("fynkEmailResetAt", "1793534460000"), store);
    }
}
