// Icon of each category, for movement rows and the category dropdown. The design draws Mercado
// as a bag (cart), Comida as fork and knife (food), Ahorro as a piggy bank, Transporte as a bus,
// Entretenimiento as play and Servicios as a bolt (Movimientos). The others reuse the closest
// icon of the design system. Moved from M7 so every category field shows the same icons (QA
// review 2026-11-07, V11).
import { CATEGORY_IDS, categoryLabel } from '../../domain/categories';
import type { CategoryId } from '../../domain/types';
import type { IconName } from './paths';

export const CATEGORY_ICONS: Readonly<Record<CategoryId, IconName>> = {
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

/** The options of a category dropdown: Spanish label and icon, in the order given. */
export function categoryOptions(
  ids: readonly CategoryId[] = CATEGORY_IDS,
): { value: CategoryId; label: string; icon: IconName }[] {
  return ids.map((id) => ({ value: id, label: categoryLabel(id), icon: CATEGORY_ICONS[id] }));
}
