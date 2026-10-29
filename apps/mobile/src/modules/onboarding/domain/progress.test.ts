// SCRUM-69 rules of the guided setup on fixed data: the steps, skipping one or all of them,
// going back and resuming.
import {
  completeStep,
  finish,
  initialProgress,
  isFinished,
  screensUpTo,
  skipAll,
  skipStep,
  start,
  visit,
  type OnboardingProgress,
} from './progress';
import {
  ONBOARDING_STEPS,
  TOTAL_STEPS,
  isStepId,
  nextStep,
  previousStep,
  stepNumber,
} from './steps';

const NOW = '2026-10-29T15:00:00.000Z';
const at = (over: Partial<OnboardingProgress>): OnboardingProgress => ({
  ...initialProgress,
  ...over,
});

describe('steps', () => {
  it('has four steps: nombre, cuentas y efectivo, metas, gastos recurrentes', () => {
    expect(ONBOARDING_STEPS).toEqual(['name', 'accounts', 'goals', 'recurring']);
    expect(TOTAL_STEPS).toBe(4);
  });

  it.each([
    ['name', 1, 'accounts', null],
    ['accounts', 2, 'goals', 'name'],
    ['goals', 3, 'recurring', 'accounts'],
    ['recurring', 4, null, 'goals'],
  ] as const)('%s is "Paso %i de 4", next %s, previous %s', (step, n, next, previous) => {
    expect(stepNumber(step)).toBe(n);
    expect(nextStep(step)).toBe(next);
    expect(previousStep(step)).toBe(previous);
  });

  it('recognizes only the current step ids', () => {
    expect(isStepId('goals')).toBe(true);
    expect(isStepId('email')).toBe(false);
    expect(isStepId(null)).toBe(false);
  });
});

describe('start', () => {
  it('goes from Aviso to the first step', () => {
    expect(start(initialProgress).step).toBe('name');
  });

  it('does not move a setup that already started', () => {
    const p = at({ step: 'goals' });
    expect(start(p)).toBe(p);
  });
});

describe('completeStep', () => {
  it('marks the step done and opens the next one', () => {
    const p = completeStep(at({ step: 'name' }), 'name', NOW);
    expect(p).toEqual(at({ step: 'accounts', completed: ['name'] }));
  });

  it('turns a skipped step into a done one when the person comes back to it', () => {
    const p = completeStep(at({ step: 'name', skipped: ['name'] }), 'name', NOW);
    expect(p.completed).toEqual(['name']);
    expect(p.skipped).toEqual([]);
  });

  it('ends the setup after the last step ("Terminar configuración")', () => {
    const p = completeStep(at({ step: 'recurring' }), 'recurring', NOW);
    expect(p.step).toBe('recurring');
    expect(p.completed).toEqual(['recurring']);
    expect(p.finishedAt).toBe(NOW);
  });
});

describe('skipStep (each step can be skipped)', () => {
  it.each([
    ['name', 'accounts'],
    ['accounts', 'goals'],
    ['goals', 'recurring'],
  ] as const)('skipping %s opens %s and leaves it pending', (step, next) => {
    const { progress, showWarning } = skipStep(at({ step }), step, NOW);
    expect(progress.step).toBe(next);
    expect(progress.skipped).toEqual([step]);
    expect(showWarning).toBe(false);
    expect(isFinished(progress)).toBe(false);
  });

  it('keeps a step that was done as done', () => {
    const { progress } = skipStep(at({ step: 'name', completed: ['name'] }), 'name', NOW);
    expect(progress.completed).toEqual(['name']);
    expect(progress.skipped).toEqual([]);
  });

  it('shows the warning first when the person skipped every step', () => {
    let p = start(initialProgress);
    let warned = false;
    for (const step of ONBOARDING_STEPS) {
      const outcome = skipStep(p, step, NOW);
      p = outcome.progress;
      warned = outcome.showWarning;
    }
    expect(warned).toBe(true);
    expect(p.step).toBe('recurring');
    expect(p.skipped).toEqual(['name', 'accounts', 'goals', 'recurring']);
    expect(isFinished(p)).toBe(false);
  });

  it('ends the setup without a warning when an earlier step was done', () => {
    const p = at({ step: 'recurring', completed: ['name'], skipped: ['accounts', 'goals'] });
    const { progress, showWarning } = skipStep(p, 'recurring', NOW);
    expect(showWarning).toBe(false);
    expect(progress.finishedAt).toBe(NOW);
  });
});

describe('visit (back button, back gesture)', () => {
  it.each([
    ['accounts', 'name'],
    ['name', 'intro'],
  ] as const)('from %s back to %s saves the screen on top', (step, previous) => {
    expect(visit(at({ step }), previous).step).toBe(previous);
  });

  it('keeps what the person did', () => {
    const p = visit(at({ step: 'goals', completed: ['name'], skipped: ['accounts'] }), 'accounts');
    expect(p).toEqual(at({ step: 'accounts', completed: ['name'], skipped: ['accounts'] }));
  });

  it('returns the same progress when the screen did not change', () => {
    const p = at({ step: 'goals' });
    expect(visit(p, 'goals')).toBe(p);
  });
});

describe('skipAll ("Omitir de todos modos")', () => {
  it('leaves every step not done pending and ends the setup', () => {
    const p = skipAll(at({ step: 'goals', completed: ['name'], skipped: ['accounts'] }), NOW);
    expect(p.completed).toEqual(['name']);
    expect(p.skipped).toEqual(['accounts', 'goals', 'recurring']);
    expect(p.finishedAt).toBe(NOW);
  });

  it('works from Aviso', () => {
    const p = skipAll(initialProgress, NOW);
    expect(p.skipped).toEqual(ONBOARDING_STEPS);
    expect(isFinished(p)).toBe(true);
  });
});

describe('a finished setup', () => {
  const done = finish(at({ step: 'recurring', completed: ['name'] }), NOW);

  it('never moves again', () => {
    const later = '2026-11-01T00:00:00.000Z';
    expect(start(done)).toBe(done);
    expect(visit(done, 'name')).toBe(done);
    expect(completeStep(done, 'recurring', later)).toBe(done);
    expect(skipStep(done, 'recurring', later).progress).toBe(done);
    expect(skipAll(done, later)).toBe(done);
    expect(finish(done, later).finishedAt).toBe(NOW);
  });
});

describe('screensUpTo (resume where it was left)', () => {
  it.each([
    ['intro', ['intro']],
    ['name', ['intro', 'name']],
    ['recurring', ['intro', 'name', 'accounts', 'goals', 'recurring']],
  ] as const)('%s reopens with %j behind it', (step, screens) => {
    expect(screensUpTo(step)).toEqual(screens);
  });
});
