// Icon of each category in the movement rows. The design draws Mercado as a bag (cart), Comida
// as fork and knife (food), Ahorro as a piggy bank, Transporte as a bus, Entretenimiento as play
// and Servicios as a bolt (Movimientos). The others reuse the closest icon of the design system.
import type { CategoryId } from '@shared/domain/types';
import type { IconName } from '@shared/ui';

export const CATEGORY_ICONS: Record<CategoryId, IconName> = {
  salary: 'arrowDown',
  income_other: 'arrowDown',
  rent: 'home',
  utilities: 'bolt',
  telecom: 'phone',
  groceries: 'cart',
  restaurants: 'food',
  cinema: 'tv',
  treats: 'coffee',
  transport: 'bus',
  subscriptions: 'play',
  health: 'shield',
  education: 'goal',
  shopping: 'cart',
  gym: 'gym',
  transfers: 'arrowUpRight',
  savings: 'piggy',
  card_payment: 'card',
  fees: 'cash',
  other: 'cardAlt',
};

/** Money in always shows the down arrow of the design, whatever its category. */
export function iconOf(categoryId: CategoryId, amountMinor: number): IconName {
  return amountMinor > 0 ? 'arrowDown' : CATEGORY_ICONS[categoryId];
}
