// What the bank returned, as the shared Account and Transaction (00-shared-contracts.md,
// section 2). Pure. The ids are derived from the bank's own ids, so every sync writes the same
// rows: M6 keeps the first id it saw per (provider, providerAccountId), and M7 matches
// movements by (accountId, providerTxId).
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

import type { components } from '@shared/api';
import { normalizeMerchant } from '@shared/domain/normalizeMerchant';
import type { Account, Id, IsoDateTime, ProviderId, Transaction } from '@shared/domain/types';

import { base64Url } from './pkce';

type RemoteAccount = components['schemas']['BankAccount'];
type RemoteTransaction = components['schemas']['BankTransaction'];

const PROVIDERS: readonly string[] = [
  'banco-demo',
  'billetera-demo',
  'bancolombia',
] satisfies ProviderId[];

// Length-prefixed parts, so ("a", "b:c") and ("a:b", "c") never give the same id.
function stableId(prefix: string, ...parts: string[]): Id {
  const text = parts.map((p) => `${p.length}:${p}`).join('');
  return `${prefix}_${base64Url(sha256(utf8ToBytes(text))).slice(0, 22)}`;
}

export const accountIdOf = (provider: string, providerAccountId: string): Id =>
  stableId('bank', provider, providerAccountId);

export const transactionIdOf = (accountId: Id, providerTxId: string): Id =>
  stableId('banktx', accountId, providerTxId);

export interface SyncContext {
  provider: string;
  linkId: Id;
  syncedAt: IsoDateTime;
}

export function toAccount(
  remote: RemoteAccount,
  { provider, linkId, syncedAt }: SyncContext,
): Account {
  if (!PROVIDERS.includes(provider)) throw new RangeError(`Unknown provider: ${provider}`);
  return {
    id: accountIdOf(provider, remote.providerAccountId),
    provider: provider as ProviderId,
    providerAccountId: remote.providerAccountId,
    linkId,
    kind: remote.kind,
    displayName: remote.displayName,
    last4: remote.last4 ?? null,
    currency: 'COP',
    balanceMinor: remote.balanceMinor,
    availableMinor: remote.availableMinor ?? null,
    creditLimitMinor: remote.creditLimitMinor ?? null,
    paymentDueOn: remote.paymentDueOn ?? null,
    status: remote.status,
    isSimulated: remote.isSimulated,
    lastSyncedAt: syncedAt,
    cdt: remote.cdt
      ? {
          rateEaBps: remote.cdt.rateEaBps,
          termDays: remote.cdt.termDays,
          openedOn: remote.cdt.openedOn,
          maturesOn: remote.cdt.maturesOn,
        }
      : null,
  };
}

/** Left as `other` from a rule: M7 categorizes the new ones on sync.completed (M5 prompt). */
export function toTransaction(remote: RemoteTransaction, accountId: Id): Transaction {
  const merchantRaw = remote.merchantRaw ?? null;
  return {
    id: transactionIdOf(accountId, remote.providerTxId),
    accountId,
    providerTxId: remote.providerTxId,
    source: 'bank',
    bookedAt: remote.bookedAt,
    amountMinor: remote.amountMinor,
    description: remote.description,
    merchantRaw,
    merchantKey: merchantRaw ? normalizeMerchant(merchantRaw) || null : null,
    categoryId: 'other',
    categorySource: 'rule',
    status: remote.status,
    goalId: null,
  };
}
