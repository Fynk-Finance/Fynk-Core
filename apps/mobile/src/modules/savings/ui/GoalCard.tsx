// One goal of "Próximas metas" (design Metas, `.goal`): blue tile with the category icon, name,
// "Viaje · Jun 2027" and a chevron; the 8 px lime progress bar; "$3.200.000 de $5.000.000",
// "Faltan 8 meses" (lime when 2 months or less) and "64%". Tapping the head expands it
// (`mt-open .28s ease-out`) to "Aporte sugerido $625.000/mes" and "Te falta $1.800.000",
// "Abonar a esta meta" (SCRUM-52, given by the screen as `abonar`) and "Editar meta".
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatCop } from '@shared/domain/money';
import {
  AmountText,
  AppText,
  Badge,
  GhostButton,
  Icon,
  ProgressBar,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalSummary } from '../domain/goal';
import { GOAL_ICONS } from './goalIcons';
import { monthLabel, savingsStrings } from './strings.es-CO';

const t = savingsStrings.metas;
const tp = savingsStrings.pace;

export interface GoalCardProps {
  goal: GoalSummary;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /** "Abonar a esta meta", shown in the open card. */
  abonar?: ReactNode;
}

export function GoalCard({ goal, expanded, onToggle, onEdit, abonar }: GoalCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const soon = goal.monthsLeft <= 2;
  return (
    <View style={styles.card} testID={`savings.goal.${goal.id}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={t.expand(goal.name)}
        accessibilityState={{ expanded }}
        style={styles.head}
        testID={`savings.goal.${goal.id}.head`}
      >
        <View style={styles.titleRow}>
          <View style={styles.tile}>
            <Icon name={GOAL_ICONS[goal.category]} size={22} color={colors.onPrimary} />
          </View>
          <View style={styles.texts}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {goal.name}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {`${savingsStrings.categories[goal.category]} · ${monthLabel(goal.deadline)}`}
            </AppText>
          </View>
          <Icon
            name={expanded ? 'chevronDown' : 'chevronRight'}
            size={20}
            color={colors.textPlaceholder}
          />
        </View>
        <ProgressBar
          progress={goal.percent / 100}
          height={8}
          accessibilityLabel={t.progressLabel(goal.name)}
        />
        <View style={styles.amounts}>
          <View style={styles.saved}>
            <AmountText amountMinor={goal.savedMinor} size={13} />
            <AppText variant="caption" color="textSecondary">
              {t.of(formatCop(goal.targetMinor))}
            </AppText>
          </View>
          <View style={styles.right}>
            <Badge label={t.monthsLeft(goal.monthsLeft)} tone={soon ? 'success' : 'info'} />
            <AppText variant="captionStrong">{`${goal.percent}%`}</AppText>
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <Open style={styles.body} testID={`savings.goal.${goal.id}.body`}>
          <View style={styles.boxes}>
            <View style={styles.box}>
              <AppText variant="caption" color="textSecondary" style={styles.small}>
                {t.suggested}
              </AppText>
              <View style={styles.inline}>
                <AmountText amountMinor={goal.suggestedMonthlyMinor} size={14} />
                <AppText variant="caption" color="textSecondary">
                  {t.perMonth}
                </AppText>
              </View>
            </View>
            <View style={styles.box}>
              <AppText variant="caption" color="textSecondary" style={styles.small}>
                {t.remaining}
              </AppText>
              <AmountText amountMinor={goal.remainingMinor} size={14} />
            </View>
          </View>
          <PaceLine goal={goal} />
          {abonar}
          <GhostButton
            label={t.edit}
            icon="chevronRight"
            onPress={onEdit}
            testID={`savings.goal.${goal.id}.edit`}
          />
        </Open>
      ) : null}
    </View>
  );
}

/**
 * "Vas a tiempo" (green check) or "Te faltan $X al mes para llegar" (red warning). A goal with no
 * aporte yet gets a neutral nudge instead of a warning.
 */
function PaceLine({ goal }: { goal: GoalSummary }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const p = goal.pace;
  if (p.status === 'done') return null;
  const [icon, color, text] =
    p.status === 'on_track'
      ? (['check', colors.accentText, tp.onTrack] as const)
      : !goal.started
        ? ([
            'calendar',
            colors.textSecondary,
            tp.notStarted(formatCop(goal.suggestedMonthlyMinor)),
          ] as const)
        : (['warning', colors.danger, tp.behind(formatCop(p.missingMonthlyMinor))] as const);
  return (
    <View style={styles.pace} testID={`savings.goal.${goal.id}.pace`}>
      <Icon name={icon} size={16} color={color} strokeWidth={2.4} />
      <AppText variant="captionStrong" style={{ color }}>
        {text}
      </AppText>
    </View>
  );
}

/** `mt-open`: fades in while moving down 6 px, 0.28 s ease-out. At rest with reduced motion. */
function Open({ children, style, testID }: { children: ReactNode; style: object; testID: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion)
      progress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) });
  }, [progress, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (progress.value - 1) * 6 }],
  }));
  return (
    <Animated.View style={[style, animated]} testID={testID}>
      {children}
    </Animated.View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.tile,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...shadow.card,
    },
    head: { gap: spacing.md, paddingVertical: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tile: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 1 },
    amounts: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    saved: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    body: { paddingBottom: 16, gap: spacing.md },
    boxes: { flexDirection: 'row', gap: spacing.md },
    box: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.input,
      backgroundColor: colors.surfaceBlueSoft,
      gap: 2,
    },
    inline: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    small: { fontSize: 11, lineHeight: 14 },
    pace: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
