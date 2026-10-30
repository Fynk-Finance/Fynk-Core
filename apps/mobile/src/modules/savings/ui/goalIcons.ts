// Icon of each goal category. The design draws a gift, a plane, a laptop and a shield; the shared
// icon set has the plane, the shield and a home, and the others use the closest icon it has.
import type { IconName } from '@shared/ui';

import type { GoalCategory } from '../domain/goals';

export const GOAL_ICONS: Record<GoalCategory, IconName> = {
  travel: 'plane',
  emergency: 'shield',
  education: 'goal',
  home: 'home',
  vehicle: 'bus',
  other: 'piggy',
};
