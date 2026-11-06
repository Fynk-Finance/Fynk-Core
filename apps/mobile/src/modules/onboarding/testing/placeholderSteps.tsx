// Stand-in for every step, for tests that do not look at a step's content: the frame, the step
// bar, "Omitir" and "Continuar" work as in the app. Test-only: never import from app code.
import { Text } from 'react-native';

import type { StepId } from '../domain/steps';
import { StepLayout } from '../ui/StepLayout';
import type { StepScreens } from '../ui/OnboardingNavigator';
import { useStepActions } from '../ui/useStepActions';

export function createPlaceholderStep(step: StepId) {
  return function PlaceholderStep() {
    const actions = useStepActions(step);
    return (
      <StepLayout step={step} actions={actions}>
        <Text>{`placeholder.${step}`}</Text>
      </StepLayout>
    );
  };
}

/** Stand-in for Listo. */
function PlaceholderListo() {
  return <Text>placeholder.done</Text>;
}

export const placeholderSteps: StepScreens = {
  name: createPlaceholderStep('name'),
  accounts: createPlaceholderStep('accounts'),
  goals: createPlaceholderStep('goals'),
  recurring: createPlaceholderStep('recurring'),
  done: PlaceholderListo,
};
