// Recordatorio de día de pago (M8 prompt, from Recomendaciones "Programar"). New screen, needs
// design review: built from the shared kit. Pushed with the default transition. Route params:
// { goalId, amountMinor? }.
//
// The amount comes from Recomendaciones ("Programa $300.000…") or from the saved reminder, and
// the day from the saved reminder or the salary M10 found. "Programar recordatorio" schedules a
// monthly local reminder; "Quitar recordatorio" removes it. It never moves money.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCop, parseCopInput } from '@shared/domain/money';
import type { Id, MoneyMinor } from '@shared/domain/types';
import {
  AppText,
  BackButton,
  GhostButton,
  PrimaryButton,
  Screen,
  Skeleton,
  TextField,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import type { PaydayService } from '../application/paydayService';
import { validatePayday, type PaydayError } from '../domain/payday';
import type { GoalSummary } from '../domain/goal';
import { paydayStrings as t } from './strings.es-CO';

export const PAYDAY_REMINDER_ROUTE = 'savings.PaydayReminder' as const;
export type PaydayReminderParams = { goalId: Id; amountMinor?: MoneyMinor };

/** "$300.000" without the sign, as the amount field shows it. */
const asField = (minor: MoneyMinor) => formatCop(minor).replace('$', '');

export function createPaydayReminderScreen({
  goals,
  payday,
  salaryDay,
  homeRoute,
}: {
  goals: Pick<GoalService, 'get'>;
  payday: PaydayService;
  /** The usual day of the salary M10 found, or null. */
  salaryDay: () => Promise<number | null>;
  /** Where to go when the screen was opened by a deep link and has nothing to go back to. */
  homeRoute?: string;
}) {
  return function PaydayReminderScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute();
    const { goalId, amountMinor } = route.params as PaydayReminderParams;
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [goal, setGoal] = useState<GoalSummary | null | undefined>(undefined);
    const [saved, setSaved] = useState(false);
    const [amount, setAmount] = useState('');
    const [day, setDay] = useState('');
    const [fromSalary, setFromSalary] = useState<number | null>(null);
    const [errors, setErrors] = useState<PaydayError[]>([]);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const leave = () => {
      if (navigation.canGoBack()) navigation.goBack();
      else if (homeRoute) navigation.navigate(homeRoute);
    };

    useEffect(() => {
      let alive = true;
      void (async () => {
        const [g, existing, salary] = await Promise.all([
          goals.get(goalId).catch(() => null),
          payday.get(goalId).catch(() => null),
          salaryDay().catch(() => null),
        ]);
        if (!alive) return;
        setGoal(g && !g.done ? g : null);
        setSaved(existing !== null);
        const startAmount = amountMinor ?? existing?.amountMinor ?? g?.suggestedMonthlyMinor;
        setAmount(startAmount ? asField(startAmount) : '');
        const startDay = existing?.day ?? salary;
        setDay(startDay ? String(startDay) : '');
        if (!existing && salary) setFromSalary(salary);
      })();
      return () => {
        alive = false;
      };
    }, [goalId, amountMinor]);

    const submit = () => {
      const input = { amountMinor: parseCopInput(amount) ?? 0, day: Number(day) };
      const found = validatePayday(input);
      setErrors(found);
      if (found.length > 0) return;
      setBusy(true);
      setFailure(null);
      payday
        .save(goalId, input)
        .then(leave)
        .catch(() => setFailure(t.failed))
        .finally(() => setBusy(false));
    };

    const remove = () => {
      setBusy(true);
      payday
        .remove(goalId)
        .then(leave)
        .catch(() => setFailure(t.failed))
        .finally(() => setBusy(false));
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={leave} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {t.title}
        </AppText>
      </View>
    );

    if (goal === undefined)
      return (
        <Screen header={header} padded testID="savings.payday">
          <Skeleton height={160} radius={radius.card} />
        </Screen>
      );

    if (goal === null)
      return (
        <Screen header={header} padded testID="savings.payday">
          <AppText variant="body" color="textSecondary">
            {t.notFound}
          </AppText>
        </Screen>
      );

    return (
      <Screen header={header} scroll padded gap={spacing.xl} testID="savings.payday">
        <AppText variant="body">{t.intro(goal.name)}</AppText>
        <TextField
          label={t.amount}
          icon="piggy"
          prefix="$"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          error={errors.includes('amount') ? t.errors.amount : undefined}
          testID="savings.payday.amount"
        />
        <TextField
          label={t.day}
          icon="calendar"
          value={day}
          onChangeText={(text) => {
            setDay(text);
            setFromSalary(null);
          }}
          keyboardType="number-pad"
          maxLength={2}
          error={errors.includes('day') ? t.errors.day : undefined}
          helper={fromSalary ? t.dayFromSalary(fromSalary) : t.dayHelper}
          testID="savings.payday.day"
        />
        <AppText variant="caption" color="textSecondary">
          {t.note}
        </AppText>
        {failure ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {failure}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <PrimaryButton
            label={saved ? t.update : t.save}
            loading={busy}
            onPress={submit}
            testID="savings.payday.save"
          />
          {saved ? (
            <GhostButton
              label={t.remove}
              tone="danger"
              disabled={busy}
              onPress={remove}
              testID="savings.payday.remove"
            />
          ) : null}
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    actions: { gap: spacing.md },
  });
