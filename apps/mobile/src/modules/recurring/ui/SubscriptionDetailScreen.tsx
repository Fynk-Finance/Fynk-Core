// Detalle de suscripción (M9 prompt; SCRUM-58, SCRUM-56, SCRUM-57). New screen, needs design
// review: it is built from the shared kit and the subscription row of Billetera. Pushed with the
// default transition from a row of "Otros gastos". Route params: { id }.
//
// Amount, periodicity and next renewal; "¿Cuánto la usas?"; the reminder switch; "Cómo
// cancelarla" (generic until the merchant catalog gives the steps and the link); "Ya la cancelé"
// (it stops counting, Fynk cancels nothing); "No es una suscripción"; "Editar". The account or
// card (M6) and the last 6 charges (M7) come when those modules export them.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountText,
  AppText,
  BackButton,
  Badge,
  Chip,
  GhostButton,
  IconTile,
  Screen,
  Skeleton,
  Switch,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { RecurringService } from '../application/recurringService';
import { PERIODICITY_LABEL, dayMonth } from '../domain/card';
import type { StoredRecurringItem } from '../domain/item';
import { nextCharge } from '../domain/schedule';
import type { Usage } from '../domain/types';
import { RECURRING_FORM_ROUTE } from './RecurringFormScreen';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.detail;
const USAGES: readonly Usage[] = ['high', 'some', 'low'];

export const SUBSCRIPTION_DETAIL_ROUTE = 'recurring.Subscription' as const;
export type SubscriptionDetailParams = { id: string };

export function createSubscriptionDetailScreen({
  service,
  today,
}: {
  service: RecurringService;
  /** Today's date in Bogotá. */
  today: () => string;
}) {
  return function SubscriptionDetailScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute();
    const { id } = route.params as SubscriptionDetailParams;
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [item, setItem] = useState<StoredRecurringItem | null | undefined>(undefined);
    const [failure, setFailure] = useState<string | null>(null);

    const load = useCallback(async () => {
      try {
        setItem(await service.get(id));
      } catch {
        setItem(null);
      }
    }, [id]);

    useEffect(() => {
      void load();
      return service.subscribe(() => void load());
    }, [load]);

    /** Runs a change and shows a message when it fails. */
    const run = (task: () => Promise<void>, after?: () => void) => {
      setFailure(null);
      task()
        .then(after)
        .catch(() => setFailure(t.failed));
    };

    const confirmCancel = (sub: StoredRecurringItem) => {
      Alert.alert(t.confirmCancel.title(sub.name), t.confirmCancel.message, [
        { text: t.confirmCancel.no, style: 'cancel' },
        {
          text: t.confirmCancel.yes,
          style: 'destructive',
          onPress: () =>
            run(
              () => service.cancel(sub.id),
              () => navigation.goBack(),
            ),
        },
      ]);
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        {item ? (
          <AppText variant="screenTitle" accessibilityRole="header" numberOfLines={2}>
            {item.name}
          </AppText>
        ) : null}
      </View>
    );

    if (item === undefined)
      return (
        <Screen header={header} padded testID="recurring.subscription">
          <Skeleton height={120} radius={radius.card} />
        </Screen>
      );

    if (item === null || item.status !== 'active')
      return (
        <Screen header={header} padded testID="recurring.subscription">
          <AppText variant="body" color="textSecondary">
            {t.notFound}
          </AppText>
        </Screen>
      );

    const next = nextCharge(item.schedule, today());
    return (
      <Screen header={header} scroll padded testID="recurring.subscription">
        <View style={styles.hero} testID="recurring.subscription.summary">
          <IconTile icon="play" tone="accent" size={44} />
          <View style={styles.heroText}>
            <AmountText amountMinor={item.amountMinor} size={24} />
            <View style={styles.inline}>
              <Badge label={PERIODICITY_LABEL[item.schedule.periodicity]} size="sm" />
              {next ? (
                <AppText variant="caption" color="textSecondary">
                  {t.renews(dayMonth(next))}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <AppText variant="label">{t.usage}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {USAGES.map((u) => (
              <Chip
                key={u}
                label={recurringStrings.form.usages[u]}
                selected={item.usage === u}
                onPress={() => run(() => service.setUsage(item.id, item.usage === u ? null : u))}
                testID={`recurring.subscription.usage.${u}`}
              />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary">
            {t.usageHelper}
          </AppText>
        </View>

        <View style={styles.reminder}>
          <View style={styles.reminderText}>
            <AppText variant="label">{t.reminder}</AppText>
            <AppText variant="caption" color="textSecondary">
              {item.reminderEnabled ? t.reminderOn : t.reminderOff}
            </AppText>
          </View>
          <Switch
            value={item.reminderEnabled}
            onValueChange={(on) => run(() => service.setReminder(item.id, on))}
            accessibilityLabel={t.reminder}
            testID="recurring.subscription.reminder"
          />
        </View>

        <View style={styles.cancelBox}>
          <AppText variant="label">{t.howToCancel}</AppText>
          <AppText variant="small" color="textSecondary">
            {t.howToCancelGeneric}
          </AppText>
        </View>

        {failure ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {failure}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <GhostButton
            label={t.cancelled}
            tone="danger"
            icon="check"
            onPress={() => confirmCancel(item)}
            testID="recurring.subscription.cancelled"
          />
          <GhostButton
            label={t.notSubscription}
            tone="neutral"
            onPress={() =>
              run(
                () => service.markNotSubscription(item.id),
                () => navigation.goBack(),
              )
            }
            testID="recurring.subscription.notSubscription"
          />
          <GhostButton
            label={t.edit}
            onPress={() => navigation.navigate(RECURRING_FORM_ROUTE, { id: item.id })}
            testID="recurring.subscription.edit"
          />
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      padding: 16,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    heroText: { flexShrink: 1, gap: 4 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    field: { gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    reminderText: { flexGrow: 1, flexShrink: 1, gap: 2 },
    cancelBox: {
      gap: 4,
      padding: 16,
      borderRadius: radius.tile,
      backgroundColor: colors.surfaceBlueSoft,
    },
    actions: { gap: spacing.md },
  });
