// How a module plugs its screens into the app (owned by M0).
// Each module exports `routes: ModuleRoutes` from its index.ts. src/app/registry.ts lists all
// 14 modules once, so no module ever edits the app shell to add a screen.
import type { ComponentType } from 'react';

import type { ModuleName } from '../domain/types';

export type TabName = 'Dashboard' | 'Billetera' | 'Recomendaciones' | 'Inversion';

export interface ModuleScreen {
  /** Unique route name, always `<module>.<Screen>`, e.g. `savings.GoalDetail`. */
  name: `${ModuleName}.${string}`;
  component: ComponentType;
  /**
   * Deep link path under the module's reserved prefix (src/app/linking.ts), without the scheme,
   * e.g. `metas/:goalId` for fynk://metas/123.
   */
  path?: string;
  /** Shown as a modal sheet instead of a pushed screen. */
  presentation?: 'card' | 'modal';
}

export interface ModuleRoutes {
  module: ModuleName;
  /** Root screen of a main tab. Only the tab's owner sets it (tabOwners in src/app/registry.ts). */
  tab?: ComponentType;
  /** Screens pushed over the tabs. */
  screens?: ModuleScreen[];
  /**
   * A whole flow shown instead of the tabs: sign in (identity), unlock (vault), onboarding.
   * It is shown while `useGate` returns true, in the order of gateOrder in src/app/registry.ts.
   */
  flow?: ComponentType;
  useGate?: () => boolean;
}
