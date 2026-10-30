// "Planes de ahorro" on the Dashboard (design Dashboard; M8 prompt `GoalsCarousel`): title and
// "Ver todos" (opens Metas), then a horizontal carousel with snap (`.hscroll`,
// `scroll-snap-align:start`) of 206 × 112 cards: lime 32 px tile with the category icon, name,
// 6 px progress bar, saved amount and percent, and a faint lime square in the top right corner.
// Only goals not reached yet. With none, one card invites to create a goal. M6 places it.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AmountText,
  AppText,
  Icon,
  ProgressBar,
  SectionHeader,
  Skeleton,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import type { GoalSummary } from '../domain/goal';
import { GOAL_FORM_ROUTE } from './GoalFormScreen';
import { GOAL_ICONS } from './goalIcons';
import { METAS_ROUTE } from './MetasScreen';
import { savingsStrings } from './strings.es-CO';
import { useGoals } from './useGoals';

const t = savingsStrings.carousel;
const CARD_WIDTH = 206;
const GAP = spacing.md;

const noIncome = async () => null;

export function createGoalsCarousel({ service }: { service: GoalService }) {
  return function GoalsCarousel() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { state } = useGoals(service, noIncome);
    const goals = state.status === 'ready' ? state.goals.filter((g) => !g.done) : [];
    const openMetas = () => navigation.navigate(METAS_ROUTE);

    return (
      <View style={styles.section} testID="savings.carousel">
        <SectionHeader title={t.title} actionLabel={t.seeAll} onAction={openMetas} />
        {state.status === 'loading' ? (
          <Skeleton height={112} radius={18} />
        ) : state.status === 'error' ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.track}
            style={styles.scroller}
          >
            {goals.length === 0 ? (
              <NewGoalCard onPress={() => navigation.navigate(GOAL_FORM_ROUTE)} />
            ) : (
              goals.map((goal) => <GoalCardCompact key={goal.id} goal={goal} onPress={openMetas} />)
            )}
          </ScrollView>
        )}
      </View>
    );
  };
}

export function GoalCardCompact({ goal, onPress }: { goal: GoalSummary; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.cardLabel(goal.name, goal.percent)}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID={`savings.carousel.${goal.id}`}
    >
      <View style={styles.corner} />
      <View style={styles.top}>
        <View style={styles.tile}>
          <Icon
            name={GOAL_ICONS[goal.category]}
            size={16}
            color={colors.onPrimary}
            strokeWidth={2.2}
          />
        </View>
        <AppText variant="smallStrong" numberOfLines={1} style={styles.name}>
          {goal.name}
        </AppText>
      </View>
      <ProgressBar progress={goal.percent / 100} height={6} />
      <View style={styles.bottom}>
        <AmountText amountMinor={goal.savedMinor} size={12} />
        <AppText variant="captionStrong" color="link" style={styles.percent}>
          {`${goal.percent}%`}
        </AppText>
      </View>
    </Pressable>
  );
}

function NewGoalCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, styles.empty, pressed ? styles.pressed : null]}
      testID="savings.carousel.new"
    >
      <View style={styles.tile}>
        <Icon name="plus" size={16} color={colors.onPrimary} strokeWidth={2.4} />
      </View>
      <AppText variant="smallStrong">{t.emptyTitle}</AppText>
      <AppText variant="caption" color="textSecondary">
        {t.emptyMessage}
      </AppText>
    </Pressable>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    section: { gap: spacing.md },
    // Bleeds to the screen edges like the design (margin 0 -16px, padding 2px 16px 16px).
    scroller: { marginHorizontal: -16 },
    track: { gap: GAP, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 16 },
    card: {
      width: CARD_WIDTH,
      height: 112,
      padding: 16,
      gap: spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      // The design uses the lime at 30 %; accentSoft is the closest token.
      borderColor: colors.accentSoft,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...shadow.card,
    },
    empty: { gap: 4 },
    pressed: { opacity: 0.85 },
    corner: {
      position: 'absolute',
      top: -24,
      right: -24,
      width: 76,
      height: 76,
      borderRadius: 20,
      backgroundColor: colors.accent,
      opacity: 0.14,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tile: {
      width: 32,
      height: 32,
      borderRadius: radius.tileSm,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { flexShrink: 1, fontSize: 14 },
    bottom: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    percent: { fontSize: 11 },
  });
