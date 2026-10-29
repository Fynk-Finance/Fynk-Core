// The onboarding gate (third in gateOrder): open until the saved progress says the setup ended.
// While the vault is locked or the session is missing, the earlier gates (sign in, unlock) win,
// so an unread progress keeps it open without ever showing it before the vault.
import type { OnboardingService } from '../application/onboardingService';
import { isFinished } from '../domain/progress';
import { useOnboardingState } from './OnboardingContext';

export function createUseOnboardingGate(service: OnboardingService) {
  // Same hooks on every render: RootNavigator calls every gate every time.
  return function useOnboardingGate(): boolean {
    const state = useOnboardingState(service);
    return !(state.status === 'ready' && isFinished(state.progress));
  };
}
