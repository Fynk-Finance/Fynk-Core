// LinkStore on the SQLCipher vault (tables in ./migrations.ts). Never logs a token.
import type { Id, IsoDateTime } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

import type { BankLink, LinkStatus } from '../../domain/link';
import type { LinkStore } from '../../application/ports';

interface LinkRow {
  id: string;
  provider: string;
  consent_id: string;
  status: LinkStatus;
  created_at: string;
  last_synced_at: string | null;
  last_attempt_at: string | null;
  revoked_at: string | null;
}

interface TokenRow {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
}

const toLink = (r: LinkRow): BankLink => ({
  id: r.id,
  provider: r.provider,
  consentId: r.consent_id,
  status: r.status,
  createdAt: r.created_at,
  lastSyncedAt: r.last_synced_at,
  lastAttemptAt: r.last_attempt_at,
  revokedAt: r.revoked_at,
});

const LINK_COLUMNS =
  'id, provider, consent_id, status, created_at, last_synced_at, last_attempt_at, revoked_at';

// Revoking keeps the first date and drops the tokens, in the same transaction.
const REVOKE = `UPDATE bank_links SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?)
                WHERE id = ?`;
const DROP_TOKENS = 'DELETE FROM bank_tokens WHERE link_id = ?';

export function createVaultLinkStore(db: VaultDb): LinkStore {
  return {
    async saveLink(link, tokens) {
      await db.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO bank_links (id, provider, consent_id, status, created_at)
           VALUES (?, ?, ?, 'active', ?)`,
          [link.id, link.provider, link.consentId, link.createdAt],
        );
        await tx.execute(
          `INSERT INTO bank_tokens (link_id, access_token, refresh_token, access_expires_at)
           VALUES (?, ?, ?, ?)`,
          [link.id, tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt],
        );
      });
    },

    async getLinks() {
      const rows = await db.query<LinkRow>(
        `SELECT ${LINK_COLUMNS} FROM bank_links ORDER BY created_at, id`,
      );
      return rows.map(toLink);
    },

    async getTokens(linkId: Id) {
      const [row] = await db.query<TokenRow>(
        `SELECT t.access_token, t.refresh_token, t.access_expires_at
         FROM bank_tokens t JOIN bank_links l ON l.id = t.link_id
         WHERE t.link_id = ? AND l.status = 'active'`,
        [linkId],
      );
      return row
        ? {
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            accessExpiresAt: row.access_expires_at,
          }
        : null;
    },

    async updateTokens(linkId, tokens) {
      // Only an active link takes new tokens: a refresh answered after a revoke is dropped.
      await db.execute(
        `UPDATE bank_tokens SET access_token = ?, refresh_token = ?, access_expires_at = ?
         WHERE link_id = (SELECT id FROM bank_links WHERE id = ? AND status = 'active')`,
        [tokens.accessToken, tokens.refreshToken, tokens.accessExpiresAt, linkId],
      );
    },

    async revokeLink(linkId: Id, at: IsoDateTime) {
      await db.transaction(async (tx) => {
        await tx.execute(REVOKE, [at, linkId]);
        await tx.execute(DROP_TOKENS, [linkId]);
      });
    },

    async revokeByConsent(consentId: Id, at: IsoDateTime) {
      return db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          'SELECT id FROM bank_links WHERE consent_id = ?',
          [consentId],
        );
        for (const { id } of rows) {
          await tx.execute(REVOKE, [at, id]);
          await tx.execute(DROP_TOKENS, [id]);
        }
        return rows.map((r) => r.id);
      });
    },
  };
}
