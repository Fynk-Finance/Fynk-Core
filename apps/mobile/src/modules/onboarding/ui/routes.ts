// Screens of the onboarding stack. Each wizard step has one route; Omitir is a modal over them.
import type { WizardStep } from '../domain/progress';

export const STEP_ROUTES = {
  intro: 'onboarding.Intro',
  name: 'onboarding.Name',
  accounts: 'onboarding.Accounts',
  goals: 'onboarding.Goals',
  recurring: 'onboarding.Recurring',
} as const satisfies Record<WizardStep, string>;

export const SKIP_ROUTE = 'onboarding.Skip';

export type OnboardingParamList = {
  [STEP_ROUTES.intro]: undefined;
  [STEP_ROUTES.name]: undefined;
  [STEP_ROUTES.accounts]: undefined;
  [STEP_ROUTES.goals]: undefined;
  [STEP_ROUTES.recurring]: undefined;
  [SKIP_ROUTE]: undefined;
};
