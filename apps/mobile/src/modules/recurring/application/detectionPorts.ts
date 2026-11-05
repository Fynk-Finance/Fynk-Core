// Ports of the detection of recurring payments (SCRUM-55). The vault adapter implements
// ProposalStore (adapters/vault/vaultProposalStore.ts).
import type { IsoDateTime, MoneyMinor } from '@shared/domain/types';

import type { Proposal } from '../domain/detect';

export interface ProposalStore {
  /** Proposals waiting for the person, best score first. */
  pending(): Promise<Proposal[]>;
  /** A pending proposal. */
  get(merchantKey: string): Promise<Proposal | null>;
  /** What the person already decided: dismissed (with the amount then) and confirmed. */
  decisions(): Promise<{ dismissed: Map<string, MoneyMinor>; confirmed: Set<string> }>;
  /** The pending proposals become these. Returns how many were not pending before. */
  replacePending(proposals: readonly Proposal[], at: IsoDateTime): Promise<number>;
  decide(merchantKey: string, status: 'dismissed' | 'confirmed', at: IsoDateTime): Promise<void>;
}
