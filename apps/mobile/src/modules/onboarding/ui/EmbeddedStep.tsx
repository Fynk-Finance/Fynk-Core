// Steps 3 · Metas (OnbMetas) and 4 · Gastos recurrentes (OnbGastos): the step frame around the
// part another module builds for it, M8's GoalsSetup or M9's RecurringSetup. Those parts bring
// their own cards, form, "Agregar…" button and totals and save in the vault by themselves, so
// "Continuar" and "Terminar configuración" only move the setup forward.
// The part arrives as a function read on render, so nothing of the other module is read while
// files load (import cycles, as in index.ts).
import type { ReactNode } from 'react';

import type { StepId } from '../domain/steps';
import { StepLayout } from './StepLayout';
import { useStepActions } from './useStepActions';

export function createEmbeddedStep(step: StepId, renderContent: () => ReactNode) {
  return function EmbeddedStep() {
    const actions = useStepActions(step);
    return (
      <StepLayout step={step} actions={actions}>
        {renderContent()}
      </StepLayout>
    );
  };
}
