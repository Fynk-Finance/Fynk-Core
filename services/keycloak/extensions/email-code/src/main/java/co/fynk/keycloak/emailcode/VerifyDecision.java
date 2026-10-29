package co.fynk.keycloak.emailcode;

import co.fynk.keycloak.emailcode.EmailCode.Check;
import java.util.function.BooleanSupplier;

/** Pure decisions of the verify-email action: no Keycloak types, so they are easy to test. */
public final class VerifyDecision {

    private VerifyDecision() {
    }

    /** What the page must do when it is shown or when a resend is requested. */
    public enum Send {
        /** Too many wrong codes: show the error and do nothing else. */
        BUDGET_EXHAUSTED,
        /** Issue a new code and send it. */
        SEND,
        /** A usable code already exists: show the form without sending. */
        FORM,
        /** A new code is needed but the cooldown is running. */
        WAIT
    }

    /**
     * First visit or page refresh. {@code trySend} starts the resend cooldown, so it is only
     * called when a new code is really needed.
     */
    public static Send onChallenge(boolean budgetExhausted, boolean hasUsableNote, BooleanSupplier trySend) {
        if (budgetExhausted) {
            return Send.BUDGET_EXHAUSTED;
        }
        if (hasUsableNote) {
            return Send.FORM;
        }
        return trySend.getAsBoolean() ? Send.SEND : Send.WAIT;
    }

    /** The person pressed "resend": always a new code, if the cooldown allows it. */
    public static Send onResend(boolean budgetExhausted, BooleanSupplier trySend) {
        if (budgetExhausted) {
            return Send.BUDGET_EXHAUSTED;
        }
        return trySend.getAsBoolean() ? Send.SEND : Send.WAIT;
    }

    public enum Kind {
        VERIFIED,
        /** Wrong code, attempts left on this code. */
        WRONG,
        /** The code can no longer be used: the person must ask for a new one. */
        REQUEST_NEW,
        /** Not 6 digits: nothing is counted. */
        MALFORMED
    }

    /**
     * @param errorEvent Keycloak error for the event, or null when there is none
     * @param recordFailure true when the wrong-code budget must go up
     * @param removeNote true when the stored note must be removed
     */
    public record Reaction(Kind kind, String errorEvent, boolean recordFailure, boolean removeNote) {
    }

    public static Reaction afterCheck(Check check) {
        return switch (check.outcome()) {
            case OK -> new Reaction(Kind.VERIFIED, null, false, true);
            case MALFORMED_INPUT -> new Reaction(Kind.MALFORMED, null, false, false);
            case WRONG -> check.updatedNote() == null
                    // the last attempt on this code failed: the note is gone, ask for a new one
                    ? new Reaction(Kind.REQUEST_NEW, "invalid_code", true, true)
                    : new Reaction(Kind.WRONG, "invalid_code", true, false);
            case EXPIRED -> new Reaction(Kind.REQUEST_NEW, "expired_code", false, true);
            case EXHAUSTED, INVALID_NOTE -> new Reaction(Kind.REQUEST_NEW, "invalid_code", false, true);
        };
    }
}
