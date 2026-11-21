// Icon of each category in the movement rows. The map lives in the design system so every
// category field shows the same icons (QA review 2026-11-07, V11).
import type { CategoryId } from '@shared/domain/types';
import { CATEGORY_ICONS, type IconName } from '@shared/ui';

export { CATEGORY_ICONS };

/** Money in always shows the down arrow of the design, whatever its category. */
export function iconOf(categoryId: CategoryId, amountMinor: number): IconName {
  return amountMinor > 0 ? 'arrowDown' : CATEGORY_ICONS[categoryId];
}
