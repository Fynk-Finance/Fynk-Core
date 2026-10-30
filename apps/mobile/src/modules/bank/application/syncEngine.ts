// The phone's sync engine (M5 prompt, Sync engine). For each active link: wait out the 60 s
// cooldown, renew the access token if needed, read the accounts and each account's movements
// since the last sync (12 months the first time), write them through M6 and M7, then tell the
// app with sync.completed or sync.failed. It only runs when called: no timers, no background.
import { isApiError } from '@shared/api';
import type { Clock, Id, Transaction } from '@shared/domain/types';
import type { AppEvent } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';

import type { BankLink } from '../domain/link';
import { toAccount, toTransaction } from '../domain/syncMapping';
import { canStartSync, needsRefresh, syncSince } from '../domain/syncRules';
import type { AccountsSink, BankApiPort, LinkStore, TransactionsSink } from './ports';

export interface SyncEngineDeps {
  api: BankApiPort;
  /** Read on every run: the vault may be locked when the module loads. */
  store: () => LinkStore;
  accounts: () => AccountsSink;
  transactions: () => TransactionsSink;
  events: { emit(event: AppEvent): void };
  clock: Clock;
}

export type LinkSyncKind = 'synced' | 'cooldown' | 'revoked' | 'failed';

export interface LinkSyncResult {
  linkId: Id;
  provider: string;
  kind: LinkSyncKind;
  /** The API's stable code when the link failed or was revoked. */
  code?: string;
}

export interface SyncReport {
  /** unavailable: the engine is not wired yet, so nothing was asked. */
  status: 'done' | 'locked' | 'unavailable';
  links: LinkSyncResult[];
}

// The backend no longer has the link or its consent: the person has to connect again.
const GONE = new Set(['consent_revoked', 'link_not_found']);
// A safety stop for a bank that keeps sending a next page.
const MAX_PAGES = 500;

const codeOf = (error: unknown) => (isApiError(error) ? error.code : 'unknown');

interface Changes {
  newTransactionIds: Id[];
  changedAccountIds: Id[];
}

export function createSyncEngine(deps: SyncEngineDeps) {
  const { api, clock } = deps;

  async function syncLink(store: LinkStore, link: BankLink, startedAt: string): Promise<Changes> {
    let tokens = await store.getTokens(link.id);
    if (!tokens) throw new Error('missing_tokens');
    if (needsRefresh(tokens, new Date(startedAt))) {
      const next = await api.refresh(link.id, tokens.refreshToken);
      tokens = {
        accessToken: next.accessToken,
        refreshToken: next.refreshToken,
        accessExpiresAt: new Date(Date.parse(startedAt) + next.expiresIn * 1000).toISOString(),
      };
      await store.updateTokens(link.id, tokens);
    }

    const context = { provider: link.provider, linkId: link.id, syncedAt: startedAt };
    const accounts = (await api.accounts(link.id, tokens.accessToken)).map((a) =>
      toAccount(a, context),
    );
    await deps.accounts().upsertFromSync(accounts);

    const since = syncSince(link.lastSyncedAt, new Date(startedAt));
    const newTransactionIds: Id[] = [];
    for (const account of accounts) {
      const transactions: Transaction[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const result = await api.transactions({
          linkId: link.id,
          accessToken: tokens.accessToken,
          providerAccountId: account.providerAccountId!,
          since,
          ...(cursor ? { cursor } : {}),
        });
        transactions.push(...result.items.map((t) => toTransaction(t, account.id)));
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      const { newIds } = await deps
        .transactions()
        .upsertFromSync({ accountId: account.id, since, transactions });
      newTransactionIds.push(...newIds);
    }
    await store.markSynced(link.id, startedAt);
    return { newTransactionIds, changedAccountIds: accounts.map((a) => a.id) };
  }

  async function run(): Promise<SyncReport> {
    let store: LinkStore;
    let links: BankLink[];
    try {
      store = deps.store();
      links = (await store.getLinks()).filter((l) => l.status === 'active');
    } catch (error) {
      if (error instanceof VaultLockedError) return { status: 'locked', links: [] };
      throw error;
    }

    const now = clock.now();
    const at = now.toISOString();
    const results: LinkSyncResult[] = [];
    const changes: Changes = { newTransactionIds: [], changedAccountIds: [] };
    let rateLimited = false;

    for (const link of links) {
      const base = { linkId: link.id, provider: link.provider };
      if (rateLimited) {
        results.push({ ...base, kind: 'failed', code: 'rate_limited' });
        continue;
      }
      if (!canStartSync(link, now)) {
        results.push({ ...base, kind: 'cooldown' });
        continue;
      }
      await store.markAttempt(link.id, at);
      try {
        const done = await syncLink(store, link, at);
        changes.newTransactionIds.push(...done.newTransactionIds);
        changes.changedAccountIds.push(...done.changedAccountIds);
        results.push({ ...base, kind: 'synced' });
      } catch (error) {
        const code =
          error instanceof Error && error.message === 'missing_tokens'
            ? 'missing_tokens'
            : codeOf(error);
        if (GONE.has(code)) {
          await store.revokeLink(link.id, at);
          await deps.accounts().markLinkRevoked(link.id);
          results.push({ ...base, kind: 'revoked', code });
        } else {
          rateLimited = code === 'rate_limited';
          results.push({ ...base, kind: 'failed', code });
        }
      }
    }

    for (const r of results) {
      if ((r.kind === 'failed' || r.kind === 'revoked') && r.code) {
        deps.events.emit({ type: 'sync.failed', at, linkId: r.linkId, code: r.code });
      }
    }
    const synced = results.filter((r) => r.kind === 'synced').map((r) => r.linkId);
    if (synced.length > 0) {
      deps.events.emit({ type: 'sync.completed', at, linkIds: synced, ...changes });
    }
    return { status: 'done', links: results };
  }

  let running: Promise<SyncReport> | null = null;
  return {
    /** Syncs every active link once. A call made while a run is going gets that same run. */
    syncAll(): Promise<SyncReport> {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
