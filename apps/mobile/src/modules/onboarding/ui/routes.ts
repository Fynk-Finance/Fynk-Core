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

/** The first step arrives from Aviso with the header already in place, so it does not slide in. */
export interface StepParams {
  fromIntro?: boolean;
}

export type OnboardingParamList = {
  [STEP_ROUTES.intro]: undefined;
  [STEP_ROUTES.name]: StepParams | undefined;
  [STEP_ROUTES.accounts]: StepParams | undefined;
  [STEP_ROUTES.goals]: StepParams | undefined;
  [STEP_ROUTES.recurring]: StepParams | undefined;
  [SKIP_ROUTE]: undefined;
};
