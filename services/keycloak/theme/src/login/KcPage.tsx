import { Suspense, lazy } from 'react';
import type { ClassKey } from 'keycloakify/login';
import DefaultPage from 'keycloakify/login/DefaultPage';
import Template from 'keycloakify/login/Template';
import type { KcContext } from './KcContext';
import { useI18n } from './i18n';
import EmailCode from './pages/EmailCode';
import ErrorPage from './pages/Error';
import Info from './pages/Info';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import UpdatePassword from './pages/UpdatePassword';

const UserProfileFormFields = lazy(() => import('keycloakify/login/UserProfileFormFields'));

// The pages below use the Fynk design. Every other page renders as Keycloak's default until its Fynk
// version is added as a case of the switch.
export default function KcPage(props: { kcContext: KcContext }) {
  const { kcContext } = props;
  const { i18n } = useI18n({ kcContext });

  return (
    <Suspense>
      {(() => {
        switch (kcContext.pageId) {
          case 'login.ftl':
            return <Login kcContext={kcContext} i18n={i18n} />;
          case 'register.ftl':
            return <Register kcContext={kcContext} i18n={i18n} />;
          case 'fynk-email-code.ftl':
            return <EmailCode kcContext={kcContext} />;
          case 'login-reset-password.ftl':
            return <ResetPassword kcContext={kcContext} i18n={i18n} />;
          case 'login-update-password.ftl':
            return <UpdatePassword kcContext={kcContext} i18n={i18n} />;
          case 'info.ftl':
            return <Info kcContext={kcContext} i18n={i18n} />;
          case 'error.ftl':
            return <ErrorPage kcContext={kcContext} />;
          default:
            return (
              <DefaultPage
                kcContext={kcContext}
                i18n={i18n}
                classes={classes}
                Template={Template}
                doUseDefaultCss={true}
                UserProfileFormFields={UserProfileFormFields}
                doMakeUserConfirmPassword={true}
              />
            );
        }
      })()}
    </Suspense>
  );
}

const classes = {} satisfies { [key in ClassKey]?: string };
