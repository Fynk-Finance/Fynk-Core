// What every step screen does: save that it is on top, and move with "Continuar", the header's
// "Omitir" and the back button. The saved move comes first; the screen changes after it.
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';

import { nextStep, type StepId } from '../domain/steps';
import { useOnboarding } from './OnboardingContext';
import { SKIP_ROUTE, STEP_ROUTES, type OnboardingParamList } from './routes';

export interface StepActions {
  /** "Continuar" (or "Terminar configuración" on the last step). */
  complete: () => Promise<void>;
  /** The header's "Omitir". */
  skip: () => Promise<void>;
  back: () => void;
  busy: boolean;
  /** The last move could not be saved. */
  failed: boolean;
}

export function useStepActions(step: StepId): StepActions {
  const service = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingParamList>>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // The back gesture pops a screen without our button, so the step on top is saved on focus.
  useFocusEffect(
    useCallback(() => {
      service.visit(step).catch(() => undefined);
    }, [service, step]),
  );

  const run = useCallback(async (move: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await move();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // After the last step the setup is finished: the gate closes and the app fades to the tabs.
  const goNext = useCallback(() => {
    const next = nextStep(step);
    if (next) navigation.navigate(STEP_ROUTES[next]);
  }, [navigation, step]);

  return {
    complete: () =>
      run(async () => {
        await service.completeStep(step);
        goNext();
      }),
    skip: () =>
      run(async () => {
        const { showWarning } = await service.skipStep(step);
        if (showWarning) navigation.navigate(SKIP_ROUTE);
        else goNext();
      }),
    back: () => navigation.goBack(),
    busy,
    failed,
  };
}
