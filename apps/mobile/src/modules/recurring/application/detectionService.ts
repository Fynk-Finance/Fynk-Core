// Detection of recurring payments after a sync (SCRUM-55, M9 prompt "Technical design"). Runs
// `detectRecurring` over the outflows of the last 12 months, keeps the proposals in the vault
// and tells how many are new. The person confirms or dismisses each one: nothing is confirmed
// by itself, and Fynk never moves money.
import type { Clock, Id, IsoDate, MoneyMinor, Transaction } from '@shared/domain/types';

import { detectRecurring, type CatalogMerchant, type Proposal } from '../domain/detect';
import type { StoredRecurringItem } from '../domain/item';
import type { ProposalStore } from './detectionPorts';
import type { RecurringService } from './recurringService';

/** The window detection looks at (M9 prompt: 12 months). */
export const DETECTION_WINDOW_DAYS = 365;

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DetectionDeps {
  proposals: () => ProposalStore;
  /** Every item the person has, cancelled ones too: their merchants are not proposed again. */
  items: () => Promise<StoredRecurringItem[]>;
  /** M7 `getTransactionsBetween`. */
  listMovements: (from: IsoDate, to: IsoDate) => Promise<Transaction[]>;
  /** The merchant catalog (SCRUM-58). Null for every merchant until the catalog exists. */
  catalog: (merchantKey: string) => CatalogMerchant | null;
  recurring: Pick<RecurringService, 'create'>;
  clock: Clock;
  /** Called after a run with the proposals that were not pending before. */
  onDetected?: (newCount: number) => void;
  /** Called after every change of the pending proposals. */
  onChange?: () => void;
}

export interface ConfirmEdits {
  name?: string;
  amountMinor?: MoneyMinor;
}

export interface DetectionService {
  /** Detects again and returns how many proposals are new. */
  run(): Promise<number>;
  pending(): Promise<Proposal[]>;
  /** Creates the recurring item of the proposal ("Confirmar"). Returns its id. */
  confirm(merchantKey: string, edits?: ConfirmEdits): Promise<Id>;
  /** "Descartar": not proposed again unless the amount changes by more than 30 %. */
  dismiss(merchantKey: string): Promise<void>;
}

export class ProposalNotFoundError extends Error {
  constructor() {
    super('The proposal does not exist or was already decided');
    this.name = 'ProposalNotFoundError';
  }
}

const isoDay = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export function createDetectionService(deps: DetectionDeps): DetectionService {
  const changed = () => deps.onChange?.();

  return {
    async run() {
      const nowMs = deps.clock.now().getTime() + BOGOTA_OFFSET_MS;
      const today = isoDay(nowMs);
      const from = isoDay(nowMs - DETECTION_WINDOW_DAYS * DAY_MS);
      const store = deps.proposals();
      const [transactions, items, decisions] = await Promise.all([
        deps.listMovements(from, today),
        deps.items(),
        store.decisions(),
      ]);
      const knownMerchantKeys = new Set(decisions.confirmed);
      for (const item of items) if (item.merchantKey) knownMerchantKeys.add(item.merchantKey);
      const proposals = detectRecurring({
        transactions,
        catalog: deps.catalog,
        knownMerchantKeys,
        dismissed: decisions.dismissed,
        today,
      });
      const added = await store.replacePending(proposals, deps.clock.now().toISOString());
      changed();
      deps.onDetected?.(added);
      return added;
    },

    pending: () => deps.proposals().pending(),

    async confirm(merchantKey, edits = {}) {
      const store = deps.proposals();
      const p = await store.get(merchantKey);
      if (!p) throw new ProposalNotFoundError();
      const id = await deps.recurring.create(
        {
          kind: p.kind,
          name: edits.name ?? p.name,
          amountMinor: edits.amountMinor ?? p.amountMinor,
          schedule: p.schedule,
          categoryId: p.categoryId,
          accountId: p.accountId,
        },
        { merchantKey },
      );
      await store.decide(merchantKey, 'confirmed', deps.clock.now().toISOString());
      changed();
      return id;
    },

    async dismiss(merchantKey) {
      const store = deps.proposals();
      if (!(await store.get(merchantKey))) throw new ProposalNotFoundError();
      await store.decide(merchantKey, 'dismissed', deps.clock.now().toISOString());
      changed();
    },
  };
}
