import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { KcPage } from './kc.gen';

// In `pnpm dev` there is no Keycloak, so a mock context is built from the query string
// (see login/dev-preview.ts). The condition is a build-time constant: the mock is removed from the theme.
const kcContext = import.meta.env.DEV
  ? (window.kcContext ??
    (await import('./login/dev-preview')).getDevKcContext(window.location.search))
  : window.kcContext;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {!kcContext ? <h1>No Keycloak Context</h1> : <KcPage kcContext={kcContext} />}
  </StrictMode>,
);
