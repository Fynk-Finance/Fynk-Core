import type { ExtendKcContext } from 'keycloakify/login';
import type { KcEnvName, ThemeName } from '../kc.gen';

export type KcContextExtension = {
  themeName: ThemeName;
  properties: Record<KcEnvName, string>;
};

// Page of the email-code extension (services/keycloak/extensions/email-code, template
// fynk-email-code.ftl). Keycloakify reads the page ids from the keys of this type to generate the .ftl.
// The attributes are the ones both Java classes set: `minutes` and `cooldownSeconds` are numbers that
// FreeMarker serializes as numbers, typed loosely because Keycloakify types other counters that way.
export type KcContextExtensionPerPage = {
  'fynk-email-code.ftl': {
    purpose: 'verify' | 'reset';
    email: string;
    minutes: number | string;
    cooldownSeconds: number | string;
  };
};

export type KcContext = ExtendKcContext<KcContextExtension, KcContextExtensionPerPage>;
