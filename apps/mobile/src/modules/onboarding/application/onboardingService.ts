// The guided setup as a small external store (SCRUM-69): it reads the saved progress when the
// vault opens, forgets it when the vault locks, and saves every move before showing it, so
// closing the app at any moment reopens the same step. Every rule comes from domain/progress.
import type { Clock, IsoDateTime } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';

import {
  completeStep,
  initialProgress,
  isFinished,
  skipAll,
  skipStep,
  start,
  visit,
  type OnboardingProgress,
  type WizardStep,
} from '../domain/progress';
import type { StepId } from '../domain/steps';
import type { ProgressStore } from './ports';

export type OnboardingState =
  /** The vault is locked, or the progress was not read yet. */
  | { status: 'unknown' }
  /** The progress could not be read. `load()` tries again. */
  | { status: 'failed' }
  | { status: 'ready'; progress: OnboardingProgress };

export interface OnboardingServiceDeps {
  /** The vault store. Throws VaultLockedError while the vault is locked. */
  store: () => ProgressStore;
  clock: Clock;
  events: Pick<AppEvents, 'on'>;
}

export interface OnboardingService {
  getState(): OnboardingState;
  /** Called after every change of the state. Returns a function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** Reads the saved progress. Runs by itself on every `vault.unlocked`. */
  load(): Promise<void>;
  /** "Comenzar configuración". */
  begin(): Promise<void>;
  /** "Continuar" on a valid step. */
  completeStep(step: StepId): Promise<void>;
  /** The header's "Omitir". `showWarning`: show the warning instead of ending the setup. */
  skipStep(step: StepId): Promise<{ showWarning: boolean }>;
  /** The screen now on top (after the back button, the back gesture or a move forward). */
  visit(step: WizardStep): Promise<void>;
  /** "Omitir de todos modos". */
  skipAll(): Promise<void>;
  /** Whether the setup ended. Throws VaultLockedError while the vault is locked. */
  isFinished(): Promise<boolean>;
  /** Stops listening to the vault. */
  dispose(): void;
}

const UNKNOWN: OnboardingState = { status: 'unknown' };
const FAILED: OnboardingState = { status: 'failed' };

export function createOnboardingService(deps: OnboardingServiceDeps): OnboardingService {
  let state: OnboardingState = UNKNOWN;
  // Bumped on every save and every lock, so a slow read never overwrites newer state.
  let version = 0;
  // One move at a time: a double tap on "Continuar" cannot skip two steps.
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();

  const set = (next: OnboardingState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };

  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work);
    queue = next.catch(() => undefined);
    return next;
  };

  const now = (): IsoDateTime => deps.clock.now().toISOString();

  async function load(): Promise<void> {
    const seen = version;
    try {
      const saved = await deps.store().load();
      if (seen === version) set({ status: 'ready', progress: saved ?? initialProgress });
    } catch (error) {
      if (seen !== version) return;
      set(error instanceof VaultLockedError ? UNKNOWN : FAILED);
    }
  }

  /** Applies a move to the current progress, saves it, then shows it. */
  function run<T>(
    apply: (
      progress: OnboardingProgress,
      at: IsoDateTime,
    ) => { progress: OnboardingProgress; result: T },
    idle: T,
  ): Promise<T> {
    return enqueue(async () => {
      if (state.status !== 'ready') return idle;
      const at = now();
      const { progress, result } = apply(state.progress, at);
      if (progress !== state.progress) {
        await deps.store().save(progress, at);
        version += 1;
        set({ status: 'ready', progress });
      }
      return result;
    });
  }

  const step = (apply: (progress: OnboardingProgress, at: IsoDateTime) => OnboardingProgress) =>
    run((p, at) => ({ progress: apply(p, at), result: undefined }), undefined);

  const stopUnlocked = deps.events.on('vault.unlocked', () => {
    void load();
  });
  const stopLocked = deps.events.on('vault.locked', () => {
    version += 1;
    set(UNKNOWN);
  });

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    load,

    begin: () => step(start),

    completeStep: (id) => step((p, at) => completeStep(p, id, at)),

    skipStep: (id) =>
      run(
        (p, at) => {
          const { progress, showWarning } = skipStep(p, id, at);
          return { progress, result: { showWarning } };
        },
        { showWarning: false },
      ),

    visit: (id) => step((p) => visit(p, id)),

    skipAll: () => step(skipAll),

    async isFinished() {
      if (state.status === 'ready') return isFinished(state.progress);
      const saved = await deps.store().load();
      return saved ? isFinished(saved) : false;
    },

    dispose() {
      stopUnlocked();
      stopLocked();
      listeners.clear();
    },
  };
}
