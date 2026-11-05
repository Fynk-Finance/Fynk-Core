// Screens of the onboarding stack. Each wizard step has one route; Omitir is a modal over them.
// Conectar banco (M5) is pushed over Cuentas: while the setup is open the app's own stack holds
// only this flow, so M5's ConnectBankButton finds the screen here.
import type { CONNECT_BANK_ROUTE as BANK_CONNECT } from '@modules/bank';

import type { WizardStep } from '../domain/progress';

export const STEP_ROUTES = {
  intro: 'onboarding.Intro',
  name: 'onboarding.Name',
  accounts: 'onboarding.Accounts',
  goals: 'onboarding.Goals',
  recurring: 'onboarding.Recurring',
} as const satisfies Record<WizardStep, string>;

export const SKIP_ROUTE = 'onboarding.Skip';

/** M5's route name. The type fails to compile if M5 renames it; nothing is imported at run time. */
export const CONNECT_BANK_ROUTE: typeof BANK_CONNECT = 'bank.Connect';

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
  [CONNECT_BANK_ROUTE]: undefined;
};
