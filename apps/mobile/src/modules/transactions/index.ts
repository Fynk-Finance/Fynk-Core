// Public API of the transactions module. Other modules import only from this file.
// M5 is the only writer of bank movements (upsertFromSync); M8 links movements to goals.
import { randomUUID } from 'expo-crypto';

import type {
  CategoryId,
  Clock,
  Id,
  IsoDate,
  IsoDateTime,
  Transaction,
} from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import {
  applyManualMovement,
  ensureCashAccount,
  InsufficientCashError,
  useAccounts,
} from '@modules/accounts';
import { getTreatsThreshold } from '@modules/analytics';
import { syncNow } from '@modules/bank';
import {
  getVaultDb,
  markDirty,
  registerBackupCollection,
  registerVaultMigrations,
} from '@modules/vault';

import { createCatalogCategory } from './adapters/catalog/catalogCategory';
import { transactionsMigrations } from './adapters/vault/migrations';
import { createVaultCategoryStore } from './adapters/vault/vaultCategoryStore';
import { createVaultManualStore } from './adapters/vault/vaultManualStore';
import { createVaultTransactionsStore } from './adapters/vault/vaultTransactionsStore';
import { createCategoryService } from './application/categoryService';
import { createManualService } from './application/manualService';
import { createTransactionsService } from './application/transactionsService';
import { createTransactionHooks } from './application/useTransactions';
import type { CategoryChange } from './domain/categoryChange';
import type { ManualInput } from './domain/manual';
import type { PageRequest, TransactionFilter, TransactionPage } from './domain/query';
import { createAllTransactionsScreen, TRANSACTIONS_ROUTE } from './ui/AllTransactionsScreen';
import { createCategoryPickerSheet } from './ui/CategoryPickerSheet';
import { createFiltersSheet, FILTERS_ROUTE } from './ui/FiltersSheet';
import { createManualTransactionSheet } from './ui/ManualTransactionSheet';
import { CATEGORY_ROUTE, DETAIL_ROUTE, NEW_TRANSACTION_ROUTE } from './ui/routes';
import { createTransactionDetailScreen } from './ui/TransactionDetailScreen';
import { createTransactionList } from './ui/TransactionList';
import { createTransactionPreview } from './ui/TransactionPreview';

export type { CategoryChange, ManualInput, PageRequest, TransactionFilter, TransactionPage };
export { InvalidManualTransactionError } from './domain/manual';
export type { TransactionCursor } from './domain/query';
export { TransactionNotFoundError } from './application/transactionsService';
export { DETAIL_ROUTE as TRANSACTION_DETAIL_ROUTE, NEW_TRANSACTION_ROUTE, TRANSACTIONS_ROUTE };
export type { ManualTransactionParams } from './ui/ManualTransactionSheet';
export type { TransactionDetailParams } from './ui/TransactionDetailScreen';
export type { AllTransactionsParams } from './ui/AllTransactionsScreen';
export type { TransactionListProps } from './ui/TransactionList';
export { InvalidSyncedTransactionError } from './domain/syncedTransactions';
export { InvalidCategoryError } from './domain/categoryChange';

registerVaultMigrations('transactions', transactionsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createTransactionsService({
  store: () => createVaultTransactionsStore(getVaultDb()),
  events: appEvents,
  treatsThreshold: () => getTreatsThreshold(),
  // M9 loads on first use, never while this file loads: M9 imports this module and reads its
  // exports while it loads, so a top-level import here would leave them undefined. Until the
  // catalog is in memory (vault.unlocked), every merchant counts as unknown.
  catalogCategory: createCatalogCategory(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- import cycle, see above
      (require('@modules/recurring') as typeof import('@modules/recurring')).getCatalogCategory,
  ),
});

// New movements of a sync are categorized once (HU-018). A locked vault or a failure leaves
// them as `other`; the person can still pick their category.
appEvents.on('sync.completed', (event) => {
  service.categorizeNew(event.newTransactionIds).catch(() => undefined);
});

const categories = createCategoryService({
  store: () => createVaultTransactionsStore(getVaultDb()),
  categories: () => createVaultCategoryStore(getVaultDb()),
  events: appEvents,
  clock,
  newId: randomUUID,
  markDirty: (collection, id) => markDirty(collection, id),
});
registerBackupCollection(categories.backupCollection);

const manual = createManualService({
  store: () => createVaultTransactionsStore(getVaultDb()),
  manual: () => createVaultManualStore(getVaultDb()),
  events: appEvents,
  // M6 updates cash and disconnected accounts. Called only inside the use cases: M6 imports
  // this module too.
  balances: { apply: (change) => applyManualMovement(change) },
  newId: randomUUID,
  markDirty: (collection, id) => markDirty(collection, id),
  treatsThreshold: () => getTreatsThreshold(),
});
registerBackupCollection(manual.backupCollection);
// A goal or category change of a manual movement is a new version of it in the backup.
appEvents.on('transactions.changed', (event) => {
  manual.markChanged(event.ids).catch(() => undefined);
});

const hooks = createTransactionHooks({
  service,
  history: (id) => categories.getCategoryHistory(id),
  events: appEvents,
});

// ---- Write API ----

/**
 * M5's TransactionsSink: saves the movements of one account after a sync. Upserts by
 * (accountId, providerTxId) keeping category and goal, deletes the pending movements since
 * `since` that the bank no longer returns, and gives the new ids for sync.completed. Throws
 * InvalidSyncedTransactionError and writes nothing when a movement is malformed.
 */
export const upsertFromSync = (input: {
  accountId: Id;
  since: IsoDateTime;
  transactions: Transaction[];
}): Promise<{ newIds: Id[] }> => service.upsertFromSync(input);

/**
 * Links a movement to a savings goal, or clears the link with null (M8). Throws
 * TransactionNotFoundError when the movement does not exist. Emits transactions.changed.
 */
export const setTransactionGoal = (id: Id, goalId: Id | null): Promise<void> =>
  service.setTransactionGoal(id, goalId);

/**
 * Changes the category of a movement (HU-018). With applyToMerchant, every movement of its
 * merchant and the next ones get it too. Writes the history and emits transactions.changed.
 */
export const changeCategory = (
  id: Id,
  categoryId: CategoryId,
  opts?: { applyToMerchant?: boolean },
): Promise<Id[]> => categories.changeCategory(id, categoryId, opts);

/**
 * Registers a gasto or ingreso by hand, in cash or any account (Nuevo movimiento manual). In
 * cash or a disconnected account it changes that balance; a connected account keeps its bank's.
 * Throws InvalidManualTransactionError on bad input, and M6's InsufficientCashError, saving
 * nothing, when a Gasto is bigger than the cash.
 */
export const addManualTransaction = (input: ManualInput): Promise<Transaction> =>
  manual.addManualTransaction(input);

/** Edits a manual movement. Throws TransactionNotFoundError for a bank one. */
export const updateManualTransaction = (id: Id, input: ManualInput): Promise<Transaction> =>
  manual.updateManualTransaction(id, input);

/** Deletes a manual movement. Throws TransactionNotFoundError for a bank one. */
export const deleteManualTransaction = (id: Id): Promise<void> =>
  manual.deleteManualTransaction(id);

// ---- Read API ----

/** The category changes of a movement, newest first. */
export const getCategoryHistory = (id: Id): Promise<CategoryChange[]> =>
  categories.getCategoryHistory(id);

/** One page of movements, newest first. Pass the page's nextCursor to get the next one. */
export const queryTransactions = (
  filter: TransactionFilter,
  page?: PageRequest,
): Promise<TransactionPage> => service.queryTransactions(filter, page);

/** Every movement booked on Bogotá days `from` to `to`, both included, newest first (M9, M10). */
export const getTransactionsBetween = (from: IsoDate, to: IsoDate): Promise<Transaction[]> =>
  service.getTransactionsBetween(from, to);

/**
 * Movements whose description or merchant has every typed word as a prefix, without case or
 * accents ("SUPERMERC" and "supermércado" find "Supermercado"). At most 50, newest first.
 */
export const searchTransactions = (text: string): Promise<Transaction[]> =>
  service.searchTransactions(text);

/** One movement, or null. */
export const getTransaction = (id: Id): Promise<Transaction | null> => service.getTransaction(id);

// ---- Screens ----

// Other modules are used only inside functions, never while this file loads: M5 and M6 import
// this module too, and an import cycle must not see an undefined value (vault/index.ts does
// the same with identity).
/** Movimientos, from "Ver todo" on the Dashboard. */
export const AllTransactionsScreen = createAllTransactionsScreen({
  hooks,
  useAccounts: () => useAccounts(),
  refresh: () => syncNow(),
  clock,
});

/** "Movimientos" of the Dashboard: the 3 latest movements and "Ver todo" (M6). */
export const TransactionPreview = createTransactionPreview({
  hooks,
  useAccounts: () => useAccounts(),
});

/** Detalle de movimiento: { id }. */
export const TransactionDetailScreen = createTransactionDetailScreen({
  hooks,
  useAccounts: () => useAccounts(),
  deleteManual: (id) => manual.deleteManualTransaction(id),
});

/** The movements of a filter, e.g. one account in Detalle de cuenta (M6). */
export const TransactionList = createTransactionList({ hooks });

export const routes: ModuleRoutes = {
  module: 'transactions',
  screens: [
    { name: TRANSACTIONS_ROUTE, component: AllTransactionsScreen, path: 'movimientos' },
    {
      // "Filtros" of Movimientos: a sheet (README, kinds of screen).
      name: FILTERS_ROUTE,
      component: createFiltersSheet({ useAccounts: () => useAccounts(), clock }),
      transition: 'sheet',
    },
    { name: DETAIL_ROUTE, component: TransactionDetailScreen, path: 'movimientos/:id' },
    {
      // "Cambiar categoría" of Detalle de movimiento: a sheet.
      name: CATEGORY_ROUTE,
      component: createCategoryPickerSheet({
        hooks,
        changeCategory: (id, categoryId, opts) => categories.changeCategory(id, categoryId, opts),
      }),
      transition: 'sheet',
    },
    {
      // "Registrar gasto o ingreso" (Dashboard FAB) and "Editar" of a manual movement: { id? }.
      name: NEW_TRANSACTION_ROUTE,
      component: createManualTransactionSheet({
        hooks,
        useAccounts: () => useAccounts(),
        add: (input) => manual.addManualTransaction(input),
        update: (id, input) => manual.updateManualTransaction(id, input),
        cashShortOf: (e) => (e instanceof InsufficientCashError ? e.cashMinor : null),
        // M6 imports this module too: called only on save.
        ensureCash: () => ensureCashAccount(),
        clock,
      }),
      transition: 'sheet',
    },
  ],
};
