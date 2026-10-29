// The steps of the guided setup, in order (SCRUM-69). The email is verified with a code at sign
// up (ADR 0007), so it is no longer a step. Progress is stored by step id, never by number, so
// the order can change without breaking a saved setup.
export const ONBOARDING_STEPS = ['name', 'accounts', 'goals', 'recurring'] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export const FIRST_STEP: StepId = ONBOARDING_STEPS[0];

// The list is never empty: the fallback only satisfies noUncheckedIndexedAccess.
export const LAST_STEP: StepId = ONBOARDING_STEPS[TOTAL_STEPS - 1] ?? FIRST_STEP;

export const isStepId = (value: unknown): value is StepId =>
  (ONBOARDING_STEPS as readonly unknown[]).includes(value);

/** 1-based number shown as "Paso N de 4". */
export const stepNumber = (step: StepId): number => ONBOARDING_STEPS.indexOf(step) + 1;

export function nextStep(step: StepId): StepId | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: StepId): StepId | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? (ONBOARDING_STEPS[index - 1] ?? null) : null;
}
