// Topes (new screen, needs design review): every cap with its progress and state, and
// "Nuevo tope" (HU-043). Built from shared components in the style of OnbMetas.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { categoryLabel, formatCop } from '@shared/domain';
import {
  AppText,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  GhostButton,
  Icon,
  PrimaryButton,
  ProgressBar,
  Screen,
  Skeleton,
  spacing,
  useTheme,
  useThemedStyles,
  type BadgeTone,
} from '@shared/ui';

import { useCapMutations, useCapStatuses } from '../application/hooks';
import type { CapState } from '../domain/types';
import { analyticsStrings } from './strings.es-CO';

const s = analyticsStrings.caps;

export const CAPS_ROUTE = 'analytics.Caps';
export const CAP_FORM_ROUTE = 'analytics.CapForm';

const STATE_TONE: Record<CapState, BadgeTone> = {
  ok: 'success',
  warning: 'info',
  reached: 'accent',
};

export function CapsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const query = useCapStatuses();
  const { remove } = useCapMutations();

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`${s.delete} · ${name}`, undefined, [
      { text: analyticsStrings.capForm.cancel, style: 'cancel' },
      { text: s.delete, style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen scroll testID="analytics.caps">
      <View style={styles.top}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={12}
          testID="analytics.caps.back"
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
        </Pressable>
        <AppText variant="screenTitle" accessibilityRole="header">
          {s.title}
        </AppText>
      </View>

      {query.isError ? (
        <ErrorState message={analyticsStrings.errors.load} onRetry={() => void query.refetch()} />
      ) : !query.unavailable && !query.data ? (
        <Skeleton height={120} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon="goal" title={s.empty} message={s.emptyHint} />
      ) : (
        <View style={styles.list}>
          {(query.data ?? []).map((status) => {
            const name = categoryLabel(status.cap.categoryId);
            return (
              <Card key={status.cap.id} testID={`analytics.cap.${status.cap.id}`}>
                <View style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="cardTitle">{name}</AppText>
                      <AppText variant="caption" color="textSecondary">
                        {status.cap.period === 'week' ? s.weekly : s.monthly}
                      </AppText>
                    </View>
                    <Badge label={s.state[status.state]} tone={STATE_TONE[status.state]} />
                  </View>
                  <ProgressBar
                    progress={Math.min(1, status.percent / 100)}
                    accessibilityLabel={`${name}: ${status.percent} %`}
                  />
                  <AppText variant="small" color="textSecondary">
                    {`${s.progress(formatCop(status.spentMinor), formatCop(status.cap.capMinor))} · ${status.percent} %`}
                  </AppText>
                  <View style={styles.actions}>
                    <GhostButton
                      label={s.edit}
                      size="md"
                      onPress={() => navigation.navigate(CAP_FORM_ROUTE, { capId: status.cap.id })}
                      testID={`analytics.cap.${status.cap.id}.edit`}
                    />
                    <GhostButton
                      label={s.delete}
                      size="md"
                      tone="danger"
                      onPress={() => confirmDelete(status.cap.id, name)}
                      testID={`analytics.cap.${status.cap.id}.delete`}
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <PrimaryButton
        label={s.newCap}
        icon="plus"
        onPress={() => navigation.navigate(CAP_FORM_ROUTE)}
        disabled={query.unavailable}
        testID="analytics.caps.new"
      />
    </Screen>
  );
}

function createStyles() {
  return StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    list: { gap: spacing.xl },
    card: { gap: spacing.lg, padding: spacing.xl },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    flex: { flex: 1 },
    actions: { flexDirection: 'row', gap: spacing.md },
  });
}
