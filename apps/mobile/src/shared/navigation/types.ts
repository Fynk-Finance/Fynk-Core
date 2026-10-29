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
  /**
   * How the screen enters and leaves (shared contracts 3.6). Default `push`. Set it only when the
   * screen's row in the inventory of docs/design/README.md says so.
   */
  transition?: ScreenTransition;
  /** Back gesture. Default: edge swipe for `push`, swipe down for `modal` and `sheet`. */
  gesture?: BackGesture;
}

/**
 * push: slides in from the right, back with the button or the edge swipe.
 * modal: slides up from the bottom, closes with its chevron or a swipe down.
 * sheet: a bottom sheet over the screen, closes with a drag down, the scrim or system back.
 * fade: cross fade, for flow changes. none: no animation.
 */
export type ScreenTransition = 'push' | 'modal' | 'sheet' | 'fade' | 'none';

/** default: the gesture of the transition. vertical: swipe down. off: buttons and system back only. */
export type BackGesture = 'default' | 'vertical' | 'off';

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
