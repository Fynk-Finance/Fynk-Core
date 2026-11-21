// Recomendaciones (M11) opens Metas with { goalId, paydayAmountMinor } when the person taps
// "Programar" (its default until it calls openPaydayReminder). Metas then pushes the payday
// reminder of that goal, once, and clears the params so going back stays on Metas.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useEffect } from 'react';

import { PAYDAY_REMINDER_ROUTE } from './PaydayReminderScreen';

export interface MetasParams {
  goalId?: string;
  paydayAmountMinor?: number;
}

export function usePaydayParams() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const params = (useRoute().params ?? {}) as MetasParams;
  const { goalId, paydayAmountMinor } = params;
  useEffect(() => {
    if (!goalId || paydayAmountMinor === undefined) return;
    navigation.setParams({ goalId: undefined, paydayAmountMinor: undefined });
    navigation.navigate(PAYDAY_REMINDER_ROUTE, { goalId, amountMinor: paydayAmountMinor });
  }, [goalId, paydayAmountMinor, navigation]);
}
