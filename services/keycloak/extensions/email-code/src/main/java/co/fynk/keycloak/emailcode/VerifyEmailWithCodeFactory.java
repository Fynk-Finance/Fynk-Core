package co.fynk.keycloak.emailcode;

import org.keycloak.Config;
import org.keycloak.authentication.RequiredActionFactory;
import org.keycloak.authentication.RequiredActionProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class VerifyEmailWithCodeFactory implements RequiredActionFactory {

    public static final String ID = "fynk-verify-email-code";

    private static final VerifyEmailWithCode INSTANCE = new VerifyEmailWithCode();

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public String getDisplayText() {
        return "Verify email with a code";
    }

    @Override
    public RequiredActionProvider create(KeycloakSession session) {
        return INSTANCE;
    }

    @Override
    public void init(Config.Scope config) {
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
    }

    @Override
    public void close() {
    }
}
