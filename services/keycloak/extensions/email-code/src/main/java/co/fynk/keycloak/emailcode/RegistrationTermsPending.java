package co.fynk.keycloak.emailcode;

import org.keycloak.authentication.FormContext;
import org.keycloak.authentication.forms.RegistrationTermsAndConditions;
import org.keycloak.common.util.Time;

/** The terms checkbox. It keeps Keycloak's check and remembers when the person accepted. */
public class RegistrationTermsPending extends RegistrationTermsAndConditions {

    public static final String ID = "fynk-registration-terms-pending";

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public String getDisplayType() {
        return "Terms and conditions (recorded when the user is created)";
    }

    @Override
    public void success(FormContext context) {
        context.getAuthenticationSession().setAuthNote(PendingRegistration.NOTE_TERMS,
                Integer.toString(Time.currentTime()));
    }
}
