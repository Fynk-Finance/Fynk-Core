// "Vincular un movimiento" (M8 prompt; SCRUM-52 "Asociar un movimiento sincronizado"). New screen,
// needs design review: built from the shared kit. Pushed from an open goal card in Metas. Lists
// the outflows of the last 60 days that are not linked yet; tapping one counts it as an aporte
// to the goal and marks it in M7 ("Aporte a plan de ahorro"). Fynk never moves money.
// Route params: { goalId }.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCop } from '@shared/domain/money';
import type { Transaction } from '@shared/domain/types';
import {
  AppText,
  BackButton,
  EmptyState,
  ListRow,
  Screen,
  Skeleton,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import {
  MovementAlreadyLinkedError,
  type ContributionService,
} from '../application/contributionService';
import type { GoalService } from '../application/goalService';
import { MONTHS_SHORT, savingsStrings } from './strings.es-CO';

const t = savingsStrings.link;

export const LINK_MOVEMENT_ROUTE = 'savings.LinkMovement' as const;
export type LinkMovementParams = { goalId: string };

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** "20 oct" from the moment a movement was booked, in Bogotá. */
export function bookedDay(bookedAt: string): string {
  const day = new Date(Date.parse(bookedAt) + BOGOTA_OFFSET_MS);
  return `${day.getUTCDate()} ${MONTHS_SHORT[day.getUTCMonth()]!.toLowerCase()}`;
}

export function createLinkMovementScreen({
  goals,
  contributions,
}: {
  goals: Pick<GoalService, 'get'>;
  contributions: Pick<ContributionService, 'linkableMovements' | 'linkMovement'>;
}) {
  return function LinkMovementScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { goalId } = useRoute().params as LinkMovementParams;
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [goalName, setGoalName] = useState('');
    const [movements, setMovements] = useState<Transaction[] | null>(null);
    const [failure, setFailure] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
      let active = true;
      void Promise.all([goals.get(goalId), contributions.linkableMovements()])
        .then(([goal, list]) => {
          if (!active) return;
          setGoalName(goal?.name ?? '');
          setMovements(list);
        })
        .catch(() => active && setMovements([]));
      return () => {
        active = false;
      };
    }, [goalId]);

    const link = async (tx: Transaction) => {
      if (busy) return;
      setBusy(true);
      setFailure(null);
      try {
        await contributions.linkMovement(goalId, tx);
        navigation.goBack();
      } catch (error) {
        setFailure(error instanceof MovementAlreadyLinkedError ? t.already : t.failed);
        setBusy(false);
      }
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {t.title}
        </AppText>
        {goalName ? (
          <AppText variant="small" color="textSecondary">
            {t.subtitle(goalName)}
          </AppText>
        ) : null}
      </View>
    );

    return (
      <Screen header={header} scroll padded testID="savings.link">
        <AppText variant="captionStrong" color="textSecondary">
          {t.window}
        </AppText>
        {movements === null ? (
          <Skeleton height={64} radius={radius.input} />
        ) : movements.length === 0 ? (
          <EmptyState title={t.empty} message={t.note} icon="bank" />
        ) : (
          <View style={styles.list}>
            {movements.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.description}
                subtitle={bookedDay(tx.bookedAt)}
                icon="arrowDown"
                trailing={{ kind: 'amount', amountMinor: tx.amountMinor, signed: true }}
                onPress={() => void link(tx)}
                accessibilityLabel={t.rowLabel(
                  tx.description,
                  formatCop(-tx.amountMinor),
                  bookedDay(tx.bookedAt),
                )}
                testID={`savings.link.${tx.id}`}
              />
            ))}
          </View>
        )}
        {failure ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {failure}
          </AppText>
        ) : null}
        {movements && movements.length > 0 ? (
          <AppText variant="caption" color="textSecondary">
            {t.note}
          </AppText>
        ) : null}
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    list: { gap: 2 },
  });
