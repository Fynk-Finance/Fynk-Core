// Ports of the bank module. Adapters call the Fynk API; tests use fakes.
import type { BankProvider } from '../domain/provider';

export interface ProvidersPort {
  /** `GET /providers`: the same list for everyone, in display order. */
  list(): Promise<BankProvider[]>;
}
