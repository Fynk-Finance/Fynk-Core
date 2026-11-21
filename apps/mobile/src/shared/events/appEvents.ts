// App events (00-shared-contracts.md, section 3.3). Owned by M0.
// A small typed emitter so modules can react to each other without importing each other.
import type { Id, IsoDateTime } from '../domain/types';

export type AppEvent =
  | {
      type: 'sync.completed';
      at: IsoDateTime;
      linkIds: Id[];
      newTransactionIds: Id[];
      changedAccountIds: Id[];
    }
  | { type: 'sync.failed'; at: IsoDateTime; linkId: Id; code: string }
  | { type: 'transactions.changed'; ids: Id[] }
  | { type: 'goal.progress'; goalId: Id; percent: number }
  | { type: 'recurring.detected'; count: number }
  | { type: 'vault.unlocked' }
  | { type: 'vault.locked' };

export type AppEventType = AppEvent['type'];
export type AppEventOf<T extends AppEventType> = Extract<AppEvent, { type: T }>;

export interface AppEvents {
  emit(e: AppEvent): void;
  /** Subscribes to one event type. Returns a function that unsubscribes. */
  on<T extends AppEventType>(type: T, fn: (e: AppEventOf<T>) => void): () => void;
}

export type ListenerErrorHandler = (error: unknown, event: AppEvent) => void;

// Only the event type is reported: payloads must never reach logs.
const reportListenerError: ListenerErrorHandler = (error, event) => {
  console.error(`[appEvents] a listener of "${event.type}" failed`, error);
};

export function createAppEvents(
  onListenerError: ListenerErrorHandler = reportListenerError,
): AppEvents {
  const listeners = new Map<AppEventType, Set<(e: AppEvent) => void>>();

  return {
    emit(e) {
      // Copy first, so a listener that unsubscribes during emit does not skip another one.
      const current = [...(listeners.get(e.type) ?? [])];
      for (const fn of current) {
        try {
          fn(e);
        } catch (error) {
          onListenerError(error, e);
        }
      }
    },
    on(type, fn) {
      const wrapped = fn as (e: AppEvent) => void;
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    },
  };
}

/** The app-wide event bus. Tests use createAppEvents() for an isolated one. */
export const appEvents: AppEvents = createAppEvents();
