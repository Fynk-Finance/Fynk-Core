// Entities the person can connect (M5's GET /providers). Pure: no React, no I/O.

export type ProviderKind = 'bank' | 'wallet';

export interface BankProvider {
  id: string;
  displayName: string;
  kind: ProviderKind;
  /** The simulated entities: always shown with the "Simulado" badge. */
  isSimulated: boolean;
  supportedScopes: string[];
  logoKey: string;
}

/**
 * The fictional entities of the bank simulator. `GET /providers` marks Bancolombia's sandbox as
 * simulated too, so the flag alone cannot tell them apart.
 */
export const SIMULATOR_ENTITY_IDS: readonly string[] = [
  'banco-demo',
  'billetera-demo',
  'banco-digital-demo',
  'cooperativa-demo',
];

/**
 * The entities to offer: every real provider, plus the simulated entities where the person has
 * accounts. When the list of those is unknown (`null`, the call failed) every simulated entity
 * is offered, so the step never blocks.
 */
export function visibleProviders(
  providers: readonly BankProvider[],
  simulatedWithAccounts: readonly string[] | null,
): BankProvider[] {
  if (simulatedWithAccounts === null) return [...providers];
  return providers.filter(
    (p) => !SIMULATOR_ENTITY_IDS.includes(p.id) || simulatedWithAccounts.includes(p.id),
  );
}

/** The chosen entity, or the first one when none was chosen or it is no longer listed. */
export function selectedProvider(
  providers: readonly BankProvider[],
  selectedId: string | null,
): BankProvider | undefined {
  return providers.find((p) => p.id === selectedId) ?? providers[0];
}
