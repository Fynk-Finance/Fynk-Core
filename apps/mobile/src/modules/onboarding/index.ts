// Public API of the onboarding module. Other modules import only from this file.
import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { createProfileNameApi } from './adapters/api/profileNameApi';
import { onboardingMigrations } from './adapters/vault/migrations';
import { createVaultProgressStore } from './adapters/vault/vaultProgressStore';
import { createOnboardingService } from './application/onboardingService';
import { createNameStep } from './ui/NameStepScreen';
import { createOnboardingNavigator, placeholderSteps } from './ui/OnboardingNavigator';
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

/** The guided setup: Aviso, Nombre, Cuentas, Metas, Gastos recurrentes and Omitir. */
export const OnboardingNavigator = createOnboardingNavigator(service, {
  ...placeholderSteps,
  name: createNameStep(createProfileNameApi()),
});

/** Whether the person ended the setup (finished or skipped). Throws while the vault is locked. */
export const isOnboardingFinished = (): Promise<boolean> => service.isFinished();

export const routes: ModuleRoutes = {
  module: 'onboarding',
  // Shown after sign in and unlock until the setup ends, then the app fades to the tabs.
  flow: OnboardingNavigator,
  useGate: createUseOnboardingGate(service),
};
