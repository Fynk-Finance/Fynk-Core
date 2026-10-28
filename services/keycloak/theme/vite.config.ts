import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { keycloakify } from 'keycloakify/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    keycloakify({
      themeName: 'fynk',
      // Only the login theme is ours (the email theme comes later). The account console stays Keycloak's.
      accountThemeImplementation: 'none',
      // The image runs Keycloak 26.8.1 only (services/keycloak/Dockerfile).
      keycloakVersionTargets: {
        '22-to-25': false,
        'all-other-versions': 'fynk-keycloak-theme.jar',
      },
    }),
  ],
});
