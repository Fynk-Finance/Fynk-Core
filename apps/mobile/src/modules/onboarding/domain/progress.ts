// Where the person is in the guided setup and what they did with each step (SCRUM-69). Pure:
// the caller passes the current time. Every function returns a new progress and never moves a
// finished setup.
import type { IsoDateTime } from '@shared/domain/types';

import { FIRST_STEP, LAST_STEP, ONBOARDING_STEPS, isStepId, nextStep, type StepId } from './steps';

/** The Aviso screen comes before the first step, and Listo (the summary) after the last one. */
export type WizardStep = 'intro' | StepId | 'done';

export const isWizardStep = (value: unknown): value is WizardStep =>
  value === 'intro' || value === 'done' || isStepId(value);

export interface OnboardingProgress {
  /** The screen to reopen on: the setup continues where it was left. */
  step: WizardStep;
  completed: readonly StepId[];
  skipped: readonly StepId[];
  /** Set when the setup ends, by finishing or by skipping it. Then it is never shown again. */
  finishedAt: IsoDateTime | null;
}

export const initialProgress: OnboardingProgress = {
  step: 'intro',
  completed: [],
  skipped: [],
  finishedAt: null,
};

export const isFinished = (progress: OnboardingProgress): boolean => progress.finishedAt !== null;

const add = (list: readonly StepId[], step: StepId): StepId[] =>
  list.includes(step) ? [...list] : [...list, step];

const without = (list: readonly StepId[], step: StepId): StepId[] => list.filter((s) => s !== step);

/** "Comenzar configuración": from Aviso to the first step. */
export function start(progress: OnboardingProgress): OnboardingProgress {
  if (isFinished(progress) || progress.step !== 'intro') return progress;
  return { ...progress, step: FIRST_STEP };
}

/**
 * The person ends the setup: "Ir a mi dashboard" on Listo, or "Omitir de todos modos". The gate
 * then closes and the app fades to the tabs.
 */
export function finish(progress: OnboardingProgress, now: IsoDateTime): OnboardingProgress {
  if (isFinished(progress)) return progress;
  return { ...progress, finishedAt: now };
}

/** "Continuar" on a valid step: the step counts as done and the next one opens, or Listo. */
export function completeStep(progress: OnboardingProgress, step: StepId): OnboardingProgress {
  if (isFinished(progress)) return progress;
  const done: OnboardingProgress = {
    ...progress,
    completed: add(progress.completed, step),
    skipped: without(progress.skipped, step),
  };
  const next = nextStep(step);
  return { ...done, step: next ?? 'done' };
}

export interface SkipOutcome {
  progress: OnboardingProgress;
  /**
   * True when this skip would leave every step skipped. The setup does not end: the warning of
   * what stays pending is shown first, and the person confirms with "Omitir de todos modos".
   */
  showWarning: boolean;
}

/** The header's "Omitir": this step stays pending and the next one opens, or Listo. */
export function skipStep(progress: OnboardingProgress, step: StepId): SkipOutcome {
  if (isFinished(progress)) return { progress, showWarning: false };
  const marked: OnboardingProgress = {
    ...progress,
    // A step finished before keeps its data, so it stays done.
    skipped: progress.completed.includes(step)
      ? [...progress.skipped]
      : add(progress.skipped, step),
  };
  const next = nextStep(step);
  if (next) return { progress: { ...marked, step: next }, showWarning: false };

  const allSkipped = ONBOARDING_STEPS.every((s) => marked.skipped.includes(s));
  if (allSkipped && step === LAST_STEP) return { progress: { ...marked, step }, showWarning: true };
  return { progress: { ...marked, step: 'done' }, showWarning: false };
}

/**
 * The screen now on top of the setup. The back button, the back gesture and the forward moves
 * all end here, so the saved step is always the one the person sees.
 */
export function visit(progress: OnboardingProgress, step: WizardStep): OnboardingProgress {
  if (isFinished(progress) || progress.step === step) return progress;
  return { ...progress, step };
}

/** "Omitir de todos modos": every step not done stays pending and the setup ends. */
export function skipAll(progress: OnboardingProgress, now: IsoDateTime): OnboardingProgress {
  if (isFinished(progress)) return progress;
  const skipped = ONBOARDING_STEPS.filter((s) => !progress.completed.includes(s));
  return finish({ ...progress, skipped }, now);
}

/**
 * Aviso and every step up to `step`: the screens behind it, so back works after a restart.
 * Listo has no way back, so it opens alone.
 */
export function screensUpTo(step: WizardStep): WizardStep[] {
  if (step === 'intro' || step === 'done') return [step];
  return ['intro', ...ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf(step) + 1)];
}
