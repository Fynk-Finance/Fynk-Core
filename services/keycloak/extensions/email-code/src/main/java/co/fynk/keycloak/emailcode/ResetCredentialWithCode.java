package co.fynk.keycloak.emailcode;

import co.fynk.keycloak.emailcode.CodeMailer.Purpose;
import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.VerifyDecision.Reaction;
import co.fynk.keycloak.emailcode.VerifyDecision.Send;
import jakarta.ws.rs.core.MultivaluedMap;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Objects;
import org.jboss.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.authenticators.browser.AbstractUsernameFormAuthenticator;
import org.keycloak.common.Profile;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventBuilder;
import org.keycloak.events.EventType;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserSessionModel;
import org.keycloak.services.managers.AuthenticationManager;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Password recovery with a 6-digit code. It runs right after {@code reset-credentials-choose-user}.
 *
 * <p>No account enumeration: when the email has no account (or the account is disabled or has no
 * email), a decoy takes the place of the real path. The decoy issues and stores a code note like a
 * real one, sends nothing, and never accepts any code. It uses the same cooldown, the same budget
 * and the same pages and messages. The one difference left is time: the real path sends an SMTP
 * message and is slower, as in Keycloak's own link flow.
 *
 * <p>Codes, the address and the user name never reach the logs or the events.
 */
public class ResetCredentialWithCode implements Authenticator {

    static final String NOTE_KEY = "fynk.emailcode.reset";
    static final String TEMPLATE = "fynk-email-code.ftl";

    private static final Logger LOG = Logger.getLogger(ResetCredentialWithCode.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final UserLimits.Purpose LIMITS_PURPOSE = UserLimits.Purpose.RESET;

    private final Clock clock = Clock.systemUTC();

    /** Who the code is for. {@code user} is null for a decoy. */
    private record Target(UserModel user, String subject, String email) {
        boolean decoy() {
            return user == null;
        }
    }

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        Target target = target(context);
        UserLimits limits = limits(context);
        String note = context.getAuthenticationSession().getAuthNote(NOTE_KEY);
        Send send = VerifyDecision.onChallenge(
                limits.budgetExhausted(LIMITS_PURPOSE, target.subject()),
                EmailCode.isUsable(note, clock.instant()),
                () -> limits.tryStartSend(LIMITS_PURPOSE, target.subject()));
        act(context, limits, target, send);
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        Target target = target(context);
        UserLimits limits = limits(context);
        String subject = target.subject();
        MultivaluedMap<String, String> params = context.getHttpRequest().getDecodedFormParameters();

        if (params.containsKey("resend")) {
            act(context, limits, target, VerifyDecision.onResend(
                    limits.budgetExhausted(LIMITS_PURPOSE, subject),
                    () -> limits.tryStartSend(LIMITS_PURPOSE, subject)));
            return;
        }
        if (limits.budgetExhausted(LIMITS_PURPOSE, subject)) {
            act(context, limits, target, Send.BUDGET_EXHAUSTED);
            return;
        }

        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        Check check = ResetDecision.check(authSession.getAuthNote(NOTE_KEY), params.getFirst("code"),
                clock.instant(), target.decoy());
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
            event(context, target, null).error(reaction.errorEvent());
        }

        switch (reaction.kind()) {
            case VERIFIED -> {
                // A decoy never gets here: its checks never accept a code.
                UserModel user = Objects.requireNonNull(target.user());
                // Owning the mailbox proves the address, so a pre-registered, unverified account
                // is taken back by its real owner.
                user.setEmailVerified(true);
                limits.clearFailures(LIMITS_PURPOSE, subject);
                logoutOtherSessions(context, user);
                // After the new password, show an info page; do not log the person in.
                authSession.setAuthNote(AuthenticationManager.END_AFTER_REQUIRED_ACTIONS, "true");
                context.success();
            }
            case WRONG -> context.challenge(form(context, limits, target)
                    .setError("fynkEmailCodeWrong", check.attemptsLeft())
                    .createForm(TEMPLATE));
            case REQUEST_NEW -> context.challenge(form(context, limits, target)
                    .setError("fynkEmailCodeRequestNew")
                    .createForm(TEMPLATE));
            case MALFORMED -> context.challenge(form(context, limits, target)
                    .setError("fynkEmailCodeMalformed")
                    .createForm(TEMPLATE));
        }
    }

    private void act(AuthenticationFlowContext context, UserLimits limits, Target target, Send send) {
        switch (send) {
            case BUDGET_EXHAUSTED -> context.challenge(form(context, limits, target)
                    .setError("fynkEmailCodeTooMany")
                    .createForm(TEMPLATE));
            case FORM -> context.challenge(form(context, limits, target).createForm(TEMPLATE));
            case WAIT -> context.challenge(form(context, limits, target)
                    .setError("fynkEmailCodeWait", limits.cooldownSecondsLeft(LIMITS_PURPOSE, target.subject()))
                    .createForm(TEMPLATE));
            case SEND -> issueAndSend(context, limits, target);
        }
    }

    private void issueAndSend(AuthenticationFlowContext context, UserLimits limits, Target target) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        RealmModel realm = context.getRealm();
        long lifespan = realm.getActionTokenGeneratedByUserLifespan();
        Issued issued = EmailCode.issue(RANDOM, clock.instant(), Duration.ofSeconds(lifespan));
        authSession.setAuthNote(NOTE_KEY, issued.note());

        // A decoy stops here: the note is stored like a real one, but nothing is sent.
        if (!target.decoy()) {
            boolean sent = CodeMailer.send(context.getSession(), realm, target.user(), authSession,
                    Purpose.RESET, issued.code(), lifespan);
            if (sent) {
                event(context, target, EventType.SEND_RESET_PASSWORD).success();
            } else {
                // Like Keycloak's link flow, a failure is not shown: an error page would tell an
                // existing account from a missing one. The person can ask again after the cooldown.
                authSession.removeAuthNote(NOTE_KEY);
                event(context, target, EventType.SEND_RESET_PASSWORD).error(Errors.EMAIL_SEND_FAILED);
                LOG.error("Could not send the reset code");
            }
        }
        // The cooldown started in this request, so the page shows all of it. Counting what is left
        // would show 59 when the email took past a second boundary, and a decoy never sends one.
        context.challenge(form(context, limits, target)
                .setAttribute("cooldownSeconds", UserLimits.RESEND_COOLDOWN.getSeconds())
                .createForm(TEMPLATE));
    }

    /**
     * The real user, or a decoy. By now {@code reset-credentials-choose-user} has set the user only
     * for an enabled account and has stored the typed text in {@code ATTEMPTED_USERNAME}.
     */
    private Target target(AuthenticationFlowContext context) {
        UserModel user = context.getUser();
        String typed = context.getAuthenticationSession().getAuthNote(AbstractUsernameFormAuthenticator.ATTEMPTED_USERNAME);
        boolean hasEmail = user != null && user.getEmail() != null && !user.getEmail().isBlank();
        if (hasEmail && user.isEnabled()) {
            return new Target(user, user.getId(), typed != null ? typed : user.getEmail());
        }
        String text = typed == null ? "" : typed;
        return new Target(null, ResetDecision.decoySubject(context.getRealm().getId(), text), text);
    }

    /** A form with everything the page needs. The address is exactly what the person typed. */
    private LoginFormsProvider form(AuthenticationFlowContext context, UserLimits limits, Target target) {
        return context.form()
                .setAttribute("purpose", "reset")
                .setAttribute("email", target.email())
                .setAttribute("minutes", CodeMailer.minutes(context.getRealm().getActionTokenGeneratedByUserLifespan()))
                .setAttribute("cooldownSeconds", limits.cooldownSecondsLeft(LIMITS_PURPOSE, target.subject()));
    }

    /**
     * Our own event: no address, no user name. A null type keeps the type of the flow. A decoy has
     * no user to attach.
     */
    private EventBuilder event(AuthenticationFlowContext context, Target target, EventType type) {
        EventBuilder event = context.getEvent().clone();
        if (type != null) {
            event.event(type);
        }
        if (!target.decoy()) {
            event.user(target.user());
        }
        return event.removeDetail(Details.EMAIL).removeDetail(Details.USERNAME);
    }

    /**
     * Ends every session of the user except the one of this flow. Keycloak's
     * {@code AuthenticatorUtil.logoutOtherSessions} only accepts a required action context or an
     * action token context, so its steps are repeated here with public APIs: back-channel logout of
     * each session (with a LOGOUT event), the offline sessions, and the other root authentication
     * sessions.
     */
    private void logoutOtherSessions(AuthenticationFlowContext context, UserModel user) {
        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();
        String currentRootId = context.getAuthenticationSession().getParentSession().getId();

        session.sessions().getUserSessionsStream(realm, user)
                .filter(s -> !Objects.equals(s.getId(), currentRootId))
                .toList() // collected first: the logout removes sessions
                .forEach(s -> backchannelLogout(context, s));

        if (!Profile.isFeatureEnabled(Profile.Feature.LOGOUT_ALL_SESSIONS_V1)) {
            session.sessions().getOfflineUserSessionsStream(realm, user)
                    .filter(s -> !Objects.equals(s.getId(), currentRootId))
                    .toList()
                    .forEach(s -> backchannelLogout(context, s));
        }

        session.authenticationSessions().removeRootAuthenticationSessionsByAuthenticatedUser(realm, user, currentRootId);
    }

    private void backchannelLogout(AuthenticationFlowContext context, UserSessionModel userSession) {
        AuthenticationManager.backchannelLogout(context.getSession(), context.getRealm(), userSession,
                context.getUriInfo(), context.getConnection(), context.getHttpRequest().getHttpHeaders(), true);
        context.getEvent().clone().event(EventType.LOGOUT)
                .session(userSession)
                .user(userSession.getUser())
                .removeDetail(Details.EMAIL)
                .removeDetail(Details.USERNAME)
                .success();
    }

    private UserLimits limits(AuthenticationFlowContext context) {
        return new UserLimits(new SingleUseLimitStore(context.getSession().singleUseObjects()), clock);
    }

    @Override
    public boolean requiresUser() {
        return false;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        return true;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
    }

    @Override
    public void close() {
    }
}
