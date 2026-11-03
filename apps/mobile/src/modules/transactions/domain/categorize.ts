// Categorization pipeline (HU-018), pure: same movement and context, same category. First
// match wins:
//   1. The category the person picked for this bank movement (by the bank's id).
//   2. The person's category for the merchant ("Aplicar a todos los movimientos de ...").
//   3. The merchant catalog (M9), when it knows the merchant.
//   4. Keyword rules (rules.es-CO.ts).
//   5. A small food purchase, under the Antojos threshold (M10), becomes `treats`.
//   6. `other`.
import type { CategoryId, MoneyMinor, Transaction } from '@shared/domain/types';

import { KEYWORD_RULES, type KeywordRule } from './rules.es-CO';

export interface CategorizeContext {
  txOverrides: ReadonlyMap<string, CategoryId>;
  merchantOverrides: ReadonlyMap<string, CategoryId>;
  /** M9's catalog category for a merchant key, or null. */
  catalog?: (merchantKey: string) => CategoryId | null;
  /** Food purchases below this become `treats` ($20.000 by default, M10). */
  treatsThresholdMinor: MoneyMinor;
}

export interface CategoryResult {
  categoryId: CategoryId;
  categorySource: Transaction['categorySource'];
}

const FOOD: ReadonlySet<CategoryId> = new Set(['restaurants', 'groceries']);

/** Lowercase, no accents, every sign a space, single spaces: "ÉXITO CALLE 80" → "exito calle 80". */
export function ruleText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .join(' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const compiled = KEYWORD_RULES.map((rule) => ({
  rule,
  pattern: new RegExp(`(?:^| )(?:${rule.words.join('|')})(?= |$)`),
}));

/** The first keyword rule that matches, or null. */
export function matchRule(
  tx: Pick<Transaction, 'description' | 'merchantRaw' | 'amountMinor'>,
): KeywordRule | null {
  const text = ruleText(tx.description, tx.merchantRaw);
  const sign = tx.amountMinor > 0 ? 'in' : 'out';
  for (const { rule, pattern } of compiled) {
    if (rule.sign && rule.sign !== sign) continue;
    if (pattern.test(text)) return rule;
  }
  return null;
}

export function categorize(
  tx: Pick<
    Transaction,
    'providerTxId' | 'merchantKey' | 'description' | 'merchantRaw' | 'amountMinor'
  >,
  ctx: CategorizeContext,
): CategoryResult {
  const own = tx.providerTxId ? ctx.txOverrides.get(tx.providerTxId) : undefined;
  if (own) return { categoryId: own, categorySource: 'user' };
  const merchant = tx.merchantKey ? ctx.merchantOverrides.get(tx.merchantKey) : undefined;
  if (merchant) return { categoryId: merchant, categorySource: 'user' };

  const found =
    (tx.merchantKey ? ctx.catalog?.(tx.merchantKey) : null) ?? matchRule(tx)?.categoryId ?? null;
  if (
    found &&
    FOOD.has(found) &&
    tx.amountMinor < 0 &&
    -tx.amountMinor < ctx.treatsThresholdMinor
  ) {
    return { categoryId: 'treats', categorySource: 'rule' };
  }
  return { categoryId: found ?? 'other', categorySource: 'rule' };
}
