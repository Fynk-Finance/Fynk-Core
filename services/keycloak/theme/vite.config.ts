import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';
import { postBuild } from './postBuild.ts';

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: 'fynk',
      // Keeps account data out of the email-code page's embedded context (see postBuild.ts).
      postBuild,
      // The login theme (src/login) and the code email theme (src/email: plain FreeMarker, copied into the jar
      // as it is because it has a theme.properties) are ours. The account console stays Keycloak's.
      accountThemeImplementation: 'none',
      // The image runs Keycloak 26.8.1 only (services/keycloak/Dockerfile).
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'fynk-keycloak-theme.jar',
      },
    }),
  ],
});
