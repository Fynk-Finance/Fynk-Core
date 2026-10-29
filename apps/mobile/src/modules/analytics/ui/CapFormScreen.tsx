// Cap form (new screen, needs design review, form style of OnbMetas): category with "Antojos"
// and its threshold, period Semanal or Mensual, amount. Opened from Topes, and from
// Recomendaciones "Fijar tope" with the category and a suggested amount prefilled.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  categoryLabel,
  formatCop,
  parseCopInput,
  type CategoryId,
  type MoneyMinor,
} from '@shared/domain';
import {
  AppText,
  Chip,
  GhostButton,
  Icon,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TextField,
  spacing,
  useTheme,
  useThemedStyles,
} from '@shared/ui';

import { useCap, useCapMutations, useSuggestedCap, useTreatsThreshold } from '../application/hooks';
import type { CapInput } from '../application/analyticsService';
import type { CapPeriod, SpendingCap } from '../domain/types';
import { CAPS_ROUTE } from './CapsScreen';
import { analyticsStrings } from './strings.es-CO';

const s = analyticsStrings.capForm;

/** Categories a cap can be set on: spending only. */
export const CAPPABLE_CATEGORIES: readonly CategoryId[] = [
  'restaurants',
  'treats',
  'groceries',
  'transport',
  'shopping',
  'cinema',
  'subscriptions',
  'telecom',
  'utilities',
  'health',
  'education',
  'gym',
  'rent',
  'fees',
  'other',
];

export interface CapFormParams {
  capId?: string;
  categoryId?: CategoryId;
  suggestedMinor?: MoneyMinor;
}

/** "$200.000" from centavos, for prefilled fields. */
function asInput(minor: MoneyMinor | null | undefined): string {
  return minor && minor > 0 ? formatCop(minor) : '';
}

export function CapFormScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<RouteProp<{ form: CapFormParams | undefined }, 'form'>>();
  const params = route.params ?? {};
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const existing = useCap(params.capId);
  // Opened from a deep link there is nothing to go back to: land on Topes.
  const close = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate(CAPS_ROUTE);
  const threshold = useTreatsThreshold();
  const { save } = useCapMutations();

  // Wait for the cap being edited, so the form starts with its values (no syncing effects).
  if (params.capId && existing.data === undefined && !existing.isError) return null;
  return (
    <CapForm
      key={existing.data?.id ?? 'new'}
      params={params}
      initial={existing.data ?? null}
      savedThreshold={threshold.data ?? null}
      saving={save.isPending}
      onSubmit={(input) => save.mutate(input, { onSuccess: close })}
      onCancel={close}
      styles={styles}
      chevronColor={colors.primaryDark}
    />
  );
}

interface CapFormProps {
  params: CapFormParams;
  initial: SpendingCap | null;
  savedThreshold: MoneyMinor | null;
  saving: boolean;
  onSubmit: (input: CapInput & { treatsThresholdMinor?: MoneyMinor }) => void;
  onCancel: () => void;
  styles: ReturnType<typeof createStyles>;
  chevronColor: string;
}

function CapForm({
  params,
  initial,
  savedThreshold,
  saving,
  onSubmit,
  onCancel,
  styles,
  chevronColor,
}: CapFormProps) {
  const [categoryId, setCategoryId] = useState<CategoryId | null>(
    initial?.categoryId ?? params.categoryId ?? null,
  );
  const [period, setPeriod] = useState<CapPeriod>(initial?.period ?? 'week');
  // null until the person types: until then the field shows the prefilled or suggested amount.
  const [typedAmount, setTypedAmount] = useState<string | null>(
    initial
      ? asInput(initial.capMinor)
      : params.suggestedMinor
        ? asInput(params.suggestedMinor)
        : null,
  );
  const [typedTreats, setTypedTreats] = useState<string | null>(null);
  const suggested = useSuggestedCap(categoryId, period);
  const amount = typedAmount ?? asInput(suggested.data);
  const treats = typedTreats ?? asInput(savedThreshold);

  const capMinor = parseCopInput(amount);
  const treatsMinor = parseCopInput(treats);
  const amountValid = capMinor !== null && capMinor > 0;
  const treatsValid = categoryId !== 'treats' || (treatsMinor !== null && treatsMinor > 0);
  const canSave = categoryId !== null && amountValid && treatsValid && !saving;

  const onSave = () => {
    if (!canSave || capMinor === null) return;
    onSubmit({
      ...(params.capId ? { id: params.capId } : {}),
      categoryId,
      period,
      capMinor,
      ...(categoryId === 'treats' && treatsMinor ? { treatsThresholdMinor: treatsMinor } : {}),
    });
  };

  return (
    <Screen scroll testID="analytics.capForm">
      <View style={styles.top}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={s.cancel}
          hitSlop={12}
          testID="analytics.capForm.back"
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={chevronColor} />
        </Pressable>
        <AppText variant="screenTitle" accessibilityRole="header">
          {params.capId ? s.titleEdit : s.titleNew}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="label">{s.category}</AppText>
        <View style={styles.chips}>
          {CAPPABLE_CATEGORIES.map((id) => (
            <Chip
              key={id}
              label={categoryLabel(id)}
              selected={categoryId === id}
              onPress={() => setCategoryId(id)}
              testID={`analytics.capForm.category.${id}`}
            />
          ))}
        </View>
      </View>

      {categoryId === 'treats' ? (
        <TextField
          label={s.treatsThreshold}
          helper={s.treatsHelper}
          value={treats}
          onChangeText={setTypedTreats}
          keyboardType="numeric"
          error={treatsValid ? undefined : s.amountInvalid}
          testID="analytics.capForm.treats"
        />
      ) : null}

      <View style={styles.field}>
        <AppText variant="label">{s.period}</AppText>
        <SegmentedControl
          options={[
            { value: 'week', label: analyticsStrings.caps.weekly },
            { value: 'month', label: analyticsStrings.caps.monthly },
          ]}
          value={period}
          onChange={setPeriod}
          accessibilityLabel={s.period}
          testID="analytics.capForm.period"
        />
      </View>

      <TextField
        label={s.amount}
        helper={suggested.data ? s.suggested(formatCop(suggested.data)) : s.amountHelper}
        value={amount}
        onChangeText={setTypedAmount}
        keyboardType="numeric"
        error={amount && !amountValid ? s.amountInvalid : undefined}
        testID="analytics.capForm.amount"
      />

      <View style={styles.actions}>
        <PrimaryButton
          label={s.save}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
          testID="analytics.capForm.save"
        />
        <GhostButton label={s.cancel} onPress={onCancel} />
      </View>
    </Screen>
  );
}

function createStyles() {
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    field: { gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    actions: { gap: spacing.lg },
  });
}
