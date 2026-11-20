package co.fynk.keycloak.emailcode;

import co.fynk.keycloak.emailcode.CodeMailer.Purpose;
import co.fynk.keycloak.emailcode.EmailCode.Check;
import co.fynk.keycloak.emailcode.EmailCode.Issued;
import co.fynk.keycloak.emailcode.VerifyDecision.Reaction;
import co.fynk.keycloak.emailcode.VerifyDecision.Send;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.requiredactions.TermsAndConditions;
import org.keycloak.credential.CredentialModel;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventBuilder;
import org.keycloak.events.EventType;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.ModelDuplicateException;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RequiredActionProviderModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.credential.PasswordCredentialModel;
import org.keycloak.protocol.oidc.OIDCLoginProtocol;
import org.keycloak.services.messages.Messages;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.keycloak.userprofile.UserProfile;
import org.keycloak.userprofile.UserProfileContext;
import org.keycloak.userprofile.UserProfileProvider;
import org.keycloak.userprofile.ValidationException;

import static org.keycloak.services.managers.AuthenticationManager.NEW_USER_REGISTERED;

/**
 * Last step of the registration flow: sends a 6-digit code to the address of the pending sign-up
 * and creates the user only after the right code. Wrong, expired or too many codes create
 * nothing. Codes, the hash, the password, the address and the user name never reach the logs or
 * the events.
 */
public class RegistrationEmailCode implements Authenticator {

    static final String TEMPLATE = "fynk-email-code.ftl";

    private static final Logger LOG = Logger.getLogger(RegistrationEmailCode.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final UserLimits.Purpose LIMITS_PURPOSE = UserLimits.Purpose.VERIFY;

    private final Clock clock = Clock.systemUTC();

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        String email = pendingEmail(context);
        if (email == null) {
            expired(context);
            return;
        }
        UserLimits limits = limits(context);
        String subject = subject(context, email);
        dropCodeOfAnotherAddress(context, subject);
        String note = context.getAuthenticationSession().getAuthNote(PendingRegistration.NOTE_CODE);
        Send send = VerifyDecision.onChallenge(
                limits.budgetExhausted(LIMITS_PURPOSE, subject),
                EmailCode.isUsable(note, clock.instant()),
                () -> limits.tryStartSend(LIMITS_PURPOSE, subject));
        act(context, limits, email, send);
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        String email = pendingEmail(context);
        if (email == null) {
            expired(context);
            return;
        }
        UserLimits limits = limits(context);
        String subject = subject(context, email);
        dropCodeOfAnotherAddress(context, subject);
        MultivaluedMap<String, String> params = context.getHttpRequest().getDecodedFormParameters();

        if (params.containsKey("resend")) {
            act(context, limits, email, VerifyDecision.onResend(
                    limits.budgetExhausted(LIMITS_PURPOSE, subject),
                    () -> limits.tryStartSend(LIMITS_PURPOSE, subject)));
            return;
        }
        if (limits.budgetExhausted(LIMITS_PURPOSE, subject)) {
            act(context, limits, email, Send.BUDGET_EXHAUSTED);
            return;
        }

        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        Check check = EmailCode.verify(authSession.getAuthNote(PendingRegistration.NOTE_CODE),
                params.getFirst("code"), clock.instant());
        Reaction reaction = VerifyDecision.afterCheck(check);

        if (reaction.recordFailure()) {
            limits.recordFailure(LIMITS_PURPOSE, subject);
        }
        if (reaction.removeNote()) {
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE);
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE_SUBJECT);
        } else if (check.updatedNote() != null) {
            authSession.setAuthNote(PendingRegistration.NOTE_CODE, check.updatedNote());
        }
        if (reaction.errorEvent() != null) {
            event(context, EventType.VERIFY_EMAIL).error(reaction.errorEvent());
        }

        switch (reaction.kind()) {
            case VERIFIED -> {
                limits.clearFailures(LIMITS_PURPOSE, subject);
                createUser(context);
            }
            case WRONG -> context.challenge(form(context, limits, email)
                    .setError("fynkEmailCodeWrong", check.attemptsLeft())
                    .createForm(TEMPLATE));
            case REQUEST_NEW -> context.challenge(form(context, limits, email)
                    .setError("fynkEmailCodeRequestNew")
                    .createForm(TEMPLATE));
            case MALFORMED -> context.challenge(form(context, limits, email)
                    .setError("fynkEmailCodeMalformed")
                    .createForm(TEMPLATE));
        }
    }

    /** The right code arrived: create the user from what the form kept. */
    private void createUser(AuthenticationFlowContext context) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();
        Map<String, List<String>> attributes = PendingRegistration.decodeProfile(
                authSession.getAuthNote(PendingRegistration.NOTE_PROFILE));
        String email = PendingRegistration.email(attributes);
        if (email == null) {
            expired(context);
            return;
        }
        List<String> usernames = attributes.get(UserModel.USERNAME);
        String username = usernames == null || usernames.isEmpty() ? email : usernames.get(0);

        // Another sign-up may have taken the address while this one waited for its code.
        if (session.users().getUserByEmail(realm, email) != null
                || session.users().getUserByUsername(realm, username) != null) {
            taken(context);
            return;
        }

        MultivaluedMap<String, String> formData = new MultivaluedHashMap<>();
        attributes.forEach((name, values) -> formData.put(name, new ArrayList<>(values)));
        UserModel user;
        try {
            UserProfile profile = session.getProvider(UserProfileProvider.class)
                    .create(UserProfileContext.REGISTRATION, formData);
            user = profile.create();
        } catch (ValidationException | ModelDuplicateException e) {
            // Same outcome as a taken address: the profile no longer validates, or another
            // sign-up for this address finished at the same moment. Nothing is created.
            taken(context);
            return;
        }
        authSession.setAuthNote(NEW_USER_REGISTERED, "true");
        user.setEnabled(true);
        user.setEmailVerified(true);

        PendingRegistration.Credential credential = PendingRegistration.decodeCredential(
                authSession.getAuthNote(PendingRegistration.NOTE_CREDENTIAL));
        if (credential != null) {
            CredentialModel model = new CredentialModel();
            model.setType(PasswordCredentialModel.TYPE);
            model.setCredentialData(credential.credentialData());
            model.setSecretData(credential.secretData());
            model.setCreatedDate(System.currentTimeMillis());
            user.credentialManager().createCredentialThroughProvider(model);
        } else {
            user.addRequiredAction(UserModel.RequiredAction.UPDATE_PASSWORD);
        }

        String terms = authSession.getAuthNote(PendingRegistration.NOTE_TERMS);
        RequiredActionProviderModel tacModel = realm.getRequiredActionProviderByAlias(
                UserModel.RequiredAction.TERMS_AND_CONDITIONS.name());
        if (terms != null && tacModel != null && tacModel.isEnabled()) {
            // Same attribute and cleanup as Keycloak's registration step.
            user.setSingleAttribute(TermsAndConditions.USER_ATTRIBUTE, terms);
            authSession.removeRequiredAction(UserModel.RequiredAction.TERMS_AND_CONDITIONS);
            user.removeRequiredAction(UserModel.RequiredAction.TERMS_AND_CONDITIONS);
        }

        for (String note : PendingRegistration.ALL_NOTES) {
            authSession.removeAuthNote(note);
        }
        authSession.setClientNote(OIDCLoginProtocol.LOGIN_HINT_PARAM, username);
        context.setUser(user);

        event(context, EventType.VERIFY_EMAIL).user(user).success();
        event(context, EventType.REGISTER).user(user).detail(Details.REGISTER_METHOD, "form").success();
        context.newEvent().event(EventType.LOGIN);
        context.getEvent().client(authSession.getClient().getClientId())
                .detail(Details.REDIRECT_URI, authSession.getRedirectUri())
                .detail(Details.AUTH_METHOD, authSession.getProtocol());
        String authType = authSession.getAuthNote(Details.AUTH_TYPE);
        if (authType != null) {
            context.getEvent().detail(Details.AUTH_TYPE, authType);
        }
        context.success();
    }

    private void taken(AuthenticationFlowContext context) {
        for (String note : PendingRegistration.ALL_NOTES) {
            context.getAuthenticationSession().removeAuthNote(note);
        }
        event(context, EventType.REGISTER).error(Errors.EMAIL_IN_USE);
        context.failure(AuthenticationFlowError.GENERIC_AUTHENTICATION_ERROR,
                context.form().setError(Messages.EMAIL_EXISTS).createErrorPage(Response.Status.CONFLICT));
    }

    private void expired(AuthenticationFlowContext context) {
        context.failure(AuthenticationFlowError.GENERIC_AUTHENTICATION_ERROR,
                context.form().setError(Messages.EXPIRED_ACTION).createErrorPage(Response.Status.BAD_REQUEST));
    }

    private void act(AuthenticationFlowContext context, UserLimits limits, String email, Send send) {
        String subject = subject(context, email);
        switch (send) {
            case BUDGET_EXHAUSTED -> context.challenge(form(context, limits, email)
                    .setError("fynkEmailCodeTooMany")
                    .createForm(TEMPLATE));
            case FORM -> context.challenge(form(context, limits, email).createForm(TEMPLATE));
            case WAIT -> context.challenge(form(context, limits, email)
                    .setError("fynkEmailCodeWait", limits.cooldownSecondsLeft(LIMITS_PURPOSE, subject))
                    .createForm(TEMPLATE));
            case SEND -> sendNewCode(context, limits, email);
        }
    }

    private void sendNewCode(AuthenticationFlowContext context, UserLimits limits, String email) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        RealmModel realm = context.getRealm();
        long lifespan = realm.getActionTokenGeneratedByUserLifespan();
        Issued issued = EmailCode.issue(RANDOM, clock.instant(), Duration.ofSeconds(lifespan));
        authSession.setAuthNote(PendingRegistration.NOTE_CODE, issued.note());
        authSession.setAuthNote(PendingRegistration.NOTE_CODE_SUBJECT, subject(context, email));

        boolean sent = CodeMailer.sendToAddress(context.getSession(), realm, email, authSession,
                Purpose.VERIFY, issued.code(), lifespan);
        if (!sent) {
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE);
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE_SUBJECT);
            event(context, EventType.SEND_VERIFY_EMAIL).error(Errors.EMAIL_SEND_FAILED);
            LOG.error("Could not send the verification code");
            context.failure(AuthenticationFlowError.INTERNAL_ERROR, context.form()
                    .setError("fynkEmailCodeSendFailed")
                    .createErrorPage(Response.Status.INTERNAL_SERVER_ERROR));
            return;
        }
        event(context, EventType.SEND_VERIFY_EMAIL).success();
        context.challenge(form(context, limits, email).createForm(TEMPLATE));
    }

    /** A form with the same attributes the required-action page gets, so the theme page is unchanged. */
    private LoginFormsProvider form(AuthenticationFlowContext context, UserLimits limits, String email) {
        return context.form()
                .setAttribute("purpose", "verify")
                .setAttribute("email", email)
                .setAttribute("minutes", CodeMailer.minutes(context.getRealm().getActionTokenGeneratedByUserLifespan()))
                .setAttribute("cooldownSeconds", limits.cooldownSecondsLeft(LIMITS_PURPOSE, subject(context, email)));
    }

    /** Our own event: it carries no address and no user name. */
    private EventBuilder event(AuthenticationFlowContext context, EventType type) {
        return context.getEvent().clone()
                .event(type)
                .removeDetail(Details.EMAIL)
                .removeDetail(Details.USERNAME);
    }

    /** A code is good only for the address it was sent to. Any other code is forgotten. */
    private void dropCodeOfAnotherAddress(AuthenticationFlowContext context, String subject) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        if (!PendingRegistration.codeBelongsTo(
                authSession.getAuthNote(PendingRegistration.NOTE_CODE_SUBJECT), subject)) {
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE);
            authSession.removeAuthNote(PendingRegistration.NOTE_CODE_SUBJECT);
        }
    }

    private String pendingEmail(AuthenticationFlowContext context) {
        return PendingRegistration.email(PendingRegistration.decodeProfile(
                context.getAuthenticationSession().getAuthNote(PendingRegistration.NOTE_PROFILE)));
    }

    private String subject(AuthenticationFlowContext context, String email) {
        return PendingRegistration.limitsSubject(context.getRealm().getId(), email);
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
