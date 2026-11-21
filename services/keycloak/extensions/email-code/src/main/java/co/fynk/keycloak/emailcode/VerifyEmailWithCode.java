package co.fynk.keycloak.emailcode;

import co.fynk.keycloak.emailcode.CodeMailer.Purpose;
import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.VerifyDecision.Reaction;
import co.fynk.keycloak.emailcode.VerifyDecision.Send;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import org.jboss.logging.Logger;
import org.keycloak.authentication.RequiredActionContext;
import org.keycloak.authentication.RequiredActionProvider;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventBuilder;
import org.keycloak.events.EventType;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Verifies the email of a user with a 6-digit code instead of a link. Codes, the address and
 * the user name never reach the logs or the events.
 */
public class VerifyEmailWithCode implements RequiredActionProvider {

    static final String NOTE_KEY = "fynk.emailcode.verify";
    static final String TEMPLATE = "fynk-email-code.ftl";

    private static final Logger LOG = Logger.getLogger(VerifyEmailWithCode.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final UserLimits.Purpose LIMITS_PURPOSE = UserLimits.Purpose.VERIFY;

    private final Clock clock = Clock.systemUTC();

    @Override
    public void evaluateTriggers(RequiredActionContext context) {
        UserModel user = context.getUser();
        if (context.getRealm().isVerifyEmail() && !user.isEmailVerified()) {
            user.addRequiredAction(VerifyEmailWithCodeFactory.ID);
        }
    }

    @Override
    public void requiredActionChallenge(RequiredActionContext context) {
        UserLimits limits = limits(context);
        String subject = context.getUser().getId();
        String note = context.getAuthenticationSession().getAuthNote(NOTE_KEY);
        Send send = VerifyDecision.onChallenge(
                limits.budgetExhausted(LIMITS_PURPOSE, subject),
                EmailCode.isUsable(note, clock.instant()),
                () -> limits.tryStartSend(LIMITS_PURPOSE, subject));
        act(context, limits, send);
    }

    @Override
    public void processAction(RequiredActionContext context) {
        UserLimits limits = limits(context);
        String subject = context.getUser().getId();
        MultivaluedMap<String, String> params = context.getHttpRequest().getDecodedFormParameters();

        if (params.containsKey("resend")) {
            act(context, limits, VerifyDecision.onResend(
                    limits.budgetExhausted(LIMITS_PURPOSE, subject),
                    () -> limits.tryStartSend(LIMITS_PURPOSE, subject)));
            return;
        }
        if (limits.budgetExhausted(LIMITS_PURPOSE, subject)) {
            act(context, limits, Send.BUDGET_EXHAUSTED);
            return;
        }

        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        Check check = EmailCode.verify(authSession.getAuthNote(NOTE_KEY), params.getFirst("code"), clock.instant());
        Reaction reaction = VerifyDecision.afterCheck(check);

        if (reaction.recordFailure()) {
            limits.recordFailure(LIMITS_PURPOSE, subject);
        }
        if (reaction.removeNote()) {
            authSession.removeAuthNote(NOTE_KEY);
        } else if (check.updatedNote() != null) {
            authSession.setAuthNote(NOTE_KEY, check.updatedNote());
        }
        if (reaction.errorEvent() != null) {
            event(context, EventType.VERIFY_EMAIL).error(reaction.errorEvent());
        }

        switch (reaction.kind()) {
            case VERIFIED -> {
                context.getUser().setEmailVerified(true);
                limits.clearFailures(LIMITS_PURPOSE, subject);
                event(context, EventType.VERIFY_EMAIL).success();
                context.success();
            }
            case WRONG -> context.challenge(form(context, limits)
                    .setError("fynkEmailCodeWrong", check.attemptsLeft())
                    .createForm(TEMPLATE));
            case REQUEST_NEW -> context.challenge(form(context, limits)
                    .setError("fynkEmailCodeRequestNew")
                    .createForm(TEMPLATE));
            case MALFORMED -> context.challenge(form(context, limits)
                    .setError("fynkEmailCodeMalformed")
                    .createForm(TEMPLATE));
        }
    }

    private void act(RequiredActionContext context, UserLimits limits, Send send) {
        switch (send) {
            case BUDGET_EXHAUSTED -> context.challenge(form(context, limits)
                    .setError("fynkEmailCodeTooMany")
                    .createForm(TEMPLATE));
            case FORM -> context.challenge(form(context, limits).createForm(TEMPLATE));
            case WAIT -> context.challenge(form(context, limits)
                    .setError("fynkEmailCodeWait", limits.cooldownSecondsLeft(LIMITS_PURPOSE, context.getUser().getId()))
                    .createForm(TEMPLATE));
            case SEND -> sendNewCode(context, limits);
        }
    }

    private void sendNewCode(RequiredActionContext context, UserLimits limits) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        RealmModel realm = context.getRealm();
        long lifespan = realm.getActionTokenGeneratedByUserLifespan();
        Issued issued = EmailCode.issue(RANDOM, clock.instant(), Duration.ofSeconds(lifespan));
        authSession.setAuthNote(NOTE_KEY, issued.note());

        boolean sent = CodeMailer.send(context.getSession(), realm, context.getUser(), authSession,
                Purpose.VERIFY, issued.code(), lifespan);
        if (!sent) {
            authSession.removeAuthNote(NOTE_KEY);
            event(context, EventType.SEND_VERIFY_EMAIL).error(Errors.EMAIL_SEND_FAILED);
            LOG.error("Could not send the verification code");
            context.challenge(context.form()
                    .setError("fynkEmailCodeSendFailed")
                    .createErrorPage(Response.Status.INTERNAL_SERVER_ERROR));
            return;
        }
        event(context, EventType.SEND_VERIFY_EMAIL).success();
        context.challenge(form(context, limits).createForm(TEMPLATE));
    }

    /** A form with everything the page needs. The address is shown only to its own owner. */
    private LoginFormsProvider form(RequiredActionContext context, UserLimits limits) {
        UserModel user = context.getUser();
        return context.form()
                .setAttribute("purpose", "verify")
                .setAttribute("email", user.getEmail())
                .setAttribute("minutes", CodeMailer.minutes(context.getRealm().getActionTokenGeneratedByUserLifespan()))
                .setAttribute("cooldownSeconds", limits.cooldownSecondsLeft(LIMITS_PURPOSE, user.getId()));
    }

    /**
     * Our own event: it carries no address and no user name. With the email as user name, the
     * inherited "username" detail would be the address.
     */
    private EventBuilder event(RequiredActionContext context, EventType type) {
        return context.getEvent().clone()
                .event(type)
                .user(context.getUser())
                .removeDetail(Details.EMAIL)
                .removeDetail(Details.USERNAME);
    }

    private UserLimits limits(RequiredActionContext context) {
        return new UserLimits(new SingleUseLimitStore(context.getSession().singleUseObjects()), clock);
    }

    @Override
    public void close() {
    }
}
