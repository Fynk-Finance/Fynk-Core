// Public API of the onboarding module. Other modules import only from this file.
import { createElement } from 'react';

import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { CashInput, isConnected, setCash, useAccounts } from '@modules/accounts';
import { BankLinkList, ConnectBankButton, ConnectBankScreen } from '@modules/bank';
import { userId } from '@modules/identity';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { createProfileNameApi } from './adapters/api/profileNameApi';
import { onboardingMigrations } from './adapters/vault/migrations';
import { createVaultProgressStore } from './adapters/vault/vaultProgressStore';
import { createOnboardingService } from './application/onboardingService';
import { createDisplayName } from './application/useDisplayName';
import { createAccountsStep } from './ui/AccountsStepScreen';
import { createEmbeddedStep } from './ui/EmbeddedStep';
import { createNameStep } from './ui/NameStepScreen';
import { createOnboardingNavigator } from './ui/OnboardingNavigator';
import { createUseOnboardingGate } from './ui/useOnboardingGate';

registerVaultMigrations('onboarding', onboardingMigrations);

const clock: Clock = { now: () => new Date() };

const service = createOnboardingService({
  store: () => createVaultProgressStore(getVaultDb()),
  clock,
  events: appEvents,
});

// The vault may already be open when this module loads; otherwise `vault.unlocked` reads it.
void service.load();

const names = createProfileNameApi();
// userId is read on every render, never while this file loads.
const displayName = createDisplayName(names, () => userId());

// M8 and M9 load on first use, never while this file loads: M6 imports this module, and M9
// reads M7's exports while it loads, so loading M7 first (M7 → M6 → here → M9 → M7) would leave
// them undefined. By the first render every module is loaded, so require() only reads them.
const savings = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- import cycle, see above
  require('@modules/savings') as typeof import('@modules/savings');
const recurring = () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- import cycle, see above
  require('@modules/recurring') as typeof import('@modules/recurring');

// Accounts and bank import each other and, through accounts, this module: their values are read
// only on render, never while this file loads.
const accountsStep = createAccountsStep({
  useAccounts: () => useAccounts(),
  isConnected: (account) => isConnected(account),
  setCash: (amountMinor) => setCash(amountMinor),
  renderLinkList: (items) => createElement(BankLinkList, { items }),
  renderConnectButton: () => createElement(ConnectBankButton),
  renderCashInput: (props) => createElement(CashInput, props),
});
const ConnectBank = () => createElement(ConnectBankScreen);

/** The guided setup: Aviso, Nombre, Cuentas, Metas, Gastos recurrentes, Omitir, Conectar banco. */
export const OnboardingNavigator = createOnboardingNavigator(
  service,
  {
    name: createNameStep(names, displayName.useRememberName),
    accounts: accountsStep,
    goals: createEmbeddedStep('goals', () => createElement(savings().GoalsSetup)),
    recurring: createEmbeddedStep('recurring', () => createElement(recurring().RecurringSetup)),
  },
  ConnectBank,
);

/**
 * The name typed in the Nombre step ("Laura Gómez"), for greetings. Null while it loads, when
 * the person has no name yet, or when the profile cannot be read.
 */
export const useDisplayName = (): string | null => displayName.useDisplayName();

/** Whether the person ended the setup (finished or skipped). Throws while the vault is locked. */
export const isOnboardingFinished = (): Promise<boolean> => service.isFinished();

export const routes: ModuleRoutes = {
  module: 'onboarding',
  // Shown after sign in and unlock until the setup ends, then the app fades to the tabs.
  flow: OnboardingNavigator,
  useGate: createUseOnboardingGate(service),
};
