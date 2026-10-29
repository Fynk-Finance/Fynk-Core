// Entities the person can connect (M5's GET /providers). Pure: no React, no I/O.

export type ProviderKind = 'bank' | 'wallet';

export interface BankProvider {
  id: string;
  displayName: string;
  kind: ProviderKind;
  /** Banco Demo and Billetera Demo: always shown with the "Simulado" badge. */
  isSimulated: boolean;
  supportedScopes: string[];
  logoKey: string;
}

/** The chosen entity, or the first one when none was chosen or it is no longer listed. */
export function selectedProvider(
  providers: readonly BankProvider[],
  selectedId: string | null,
): BankProvider | undefined {
  return providers.find((p) => p.id === selectedId) ?? providers[0];
}
