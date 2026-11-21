// The onboarding service for the screens of the flow, and its state as a React value.
import { createContext, useContext, useSyncExternalStore } from 'react';

import type { OnboardingService, OnboardingState } from '../application/onboardingService';

const OnboardingContext = createContext<OnboardingService | null>(null);

export const OnboardingProvider = OnboardingContext.Provider;

export function useOnboarding(): OnboardingService {
  const service = useContext(OnboardingContext);
  if (!service) throw new Error('useOnboarding needs an OnboardingProvider');
  return service;
}

export function useOnboardingState(service: OnboardingService): OnboardingState {
  return useSyncExternalStore(service.subscribe, service.getState);
}
