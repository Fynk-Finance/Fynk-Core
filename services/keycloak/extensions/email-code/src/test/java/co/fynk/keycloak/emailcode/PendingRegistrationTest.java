package co.fynk.keycloak.emailcode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PendingRegistrationTest {

    @Test
    void profileRoundTripsWithSpecialCharacters() {
        Map<String, List<String>> in = new LinkedHashMap<>();
        in.put("email", List.of("ana+test@fynk.local"));
        in.put("firstName", List.of("Ana & María = ñ"));
        in.put("tags", List.of("a", "b"));

        Map<String, List<String>> out = PendingRegistration.decodeProfile(PendingRegistration.encodeProfile(in));

        assertEquals(in, out);
        assertEquals("ana+test@fynk.local", PendingRegistration.email(out));
    }

    @Test
    void missingOrDamagedProfileDecodesToNull() {
        assertNull(PendingRegistration.decodeProfile(null));
        assertNull(PendingRegistration.decodeProfile(""));
        assertNull(PendingRegistration.decodeProfile("no-equals-sign"));
        assertNull(PendingRegistration.email(null));
        assertNull(PendingRegistration.email(Map.of("firstName", List.of("Ana"))));
        assertNull(PendingRegistration.email(Map.of("email", List.of(" "))));
    }

    @Test
    void credentialRoundTripsAndNeverPrintsItsHash() {
        var credential = new PendingRegistration.Credential(
                "{\"hashIterations\":5,\"algorithm\":\"argon2\"}", "{\"value\":\"SECRETHASH\",\"salt\":\"s\"}");

        var out = PendingRegistration.decodeCredential(PendingRegistration.encodeCredential(credential));

        assertEquals(credential, out);
        assertFalse(credential.toString().contains("SECRETHASH"));
    }

    @Test
    void damagedCredentialDecodesToNull() {
        assertNull(PendingRegistration.decodeCredential(null));
        assertNull(PendingRegistration.decodeCredential("only-one-part"));
        assertNull(PendingRegistration.decodeCredential("a.b.c"));
        assertNull(PendingRegistration.decodeCredential("!!!.???"));
    }

    @Test
    void limitsSubjectIsAHashOfTheRealmAndTheLowercasedEmail() {
        String a = PendingRegistration.limitsSubject("realm-1", "Ana@Fynk.local");
        String b = PendingRegistration.limitsSubject("realm-1", "ana@fynk.local");

        assertEquals(a, b);
        assertTrue(a.startsWith("reg:"));
        assertEquals(4 + 64, a.length());
        assertFalse(a.contains("ana"));
        assertNotEquals(a, PendingRegistration.limitsSubject("realm-2", "ana@fynk.local"));
        assertNotEquals(a, PendingRegistration.limitsSubject("realm-1", "other@fynk.local"));
    }

    @Test
    void aCodeBelongsOnlyToTheAddressItWasSentTo() {
        String a = PendingRegistration.limitsSubject("realm-1", "a@fynk.local");
        String b = PendingRegistration.limitsSubject("realm-1", "b@fynk.local");

        assertTrue(PendingRegistration.codeBelongsTo(a, a));
        assertFalse(PendingRegistration.codeBelongsTo(a, b));
        assertFalse(PendingRegistration.codeBelongsTo(null, a));
        assertFalse(PendingRegistration.codeBelongsTo(a, null));
        assertTrue(PendingRegistration.ALL_NOTES.contains(PendingRegistration.NOTE_CODE_SUBJECT));
    }

    @Test
    void everyNoteHasItsOwnName() {
        assertEquals(PendingRegistration.ALL_NOTES.size(), List.copyOf(new java.util.HashSet<>(PendingRegistration.ALL_NOTES)).size());
    }
}
