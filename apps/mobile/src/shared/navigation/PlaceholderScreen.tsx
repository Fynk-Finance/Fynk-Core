// Placeholder every module shows until its owner builds the real screen (M0, Gate A).
// Built only from design system components; it never reaches the jury demo.
import type { ComponentType } from 'react';

import { EmptyState, HeaderBlue, Screen } from '../ui';
import { navigationStrings } from './strings.es-CO';

export interface PlaceholderOptions {
  /** Screen title as the design names it, e.g. "Billetera". */
  title: string;
  /** Module code and name, e.g. "M9 · Gastos recurrentes y suscripciones". */
  owner: string;
  /** Tab roots sit under the blue header of the design. */
  withHeader?: boolean;
}

export function createPlaceholderScreen({
  title,
  owner,
  withHeader = false,
}: PlaceholderOptions): ComponentType {
  function PlaceholderScreen() {
    return (
      <Screen
        withTabBar={withHeader}
        header={
          withHeader ? (
            <HeaderBlue name={navigationStrings.placeholderUser} title={title} />
          ) : undefined
        }
      >
        <EmptyState
          icon="tabDashboard"
          title={withHeader ? navigationStrings.comingSoon : title}
          message={navigationStrings.builtBy(owner)}
        />
      </Screen>
    );
  }
  PlaceholderScreen.displayName = `Placeholder(${title})`;
  return PlaceholderScreen;
}
