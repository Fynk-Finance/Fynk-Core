// Spanish (Colombia) labels for every CategoryId (00-shared-contracts.md, section 2).
import type { CategoryId } from './types';

export const CATEGORY_LABELS: Readonly<Record<CategoryId, string>> = {
  salary: 'Salario',
  income_other: 'Otros ingresos',
  rent: 'Arriendo',
  utilities: 'Servicios públicos',
  telecom: 'Internet y celular',
  groceries: 'Mercado',
  restaurants: 'Restaurantes',
  cinema: 'Cine',
  treats: 'Antojos',
  transport: 'Transporte',
  subscriptions: 'Suscripciones',
  health: 'Salud',
  education: 'Educación',
  shopping: 'Compras',
  gym: 'Gimnasio',
  transfers: 'Transferencias',
  savings: 'Ahorro',
  card_payment: 'Pago de tarjeta',
  fees: 'Comisiones',
  other: 'Otros',
};

// Every category id, in the order of the contract.
export const CATEGORY_IDS = Object.keys(CATEGORY_LABELS) as CategoryId[];

export function categoryLabel(id: CategoryId): string {
  return CATEGORY_LABELS[id];
}

export function isCategoryId(value: string): value is CategoryId {
  return Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value);
}
