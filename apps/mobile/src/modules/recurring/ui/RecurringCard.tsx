// One card of "Gastos recurrentes" (design Billetera): 26 px icon tile and name, amount and
// periodicity badge, schedule and the state of the next charge. Tapping it opens the form.
import { Pressable, StyleSheet, View } from 'react-native';

import type { CategoryId, IsoDate } from '@shared/domain/types';
import { formatCop } from '@shared/domain/money';
import {
  AmountText,
  AppText,
  Badge,
  IconTile,
  radius,
  spacing,
  useThemedStyles,
  type BadgeTone,
  type IconName,
  type Theme,
} from '@shared/ui';

import { PERIODICITY_LABEL, chargeLabel, chargeState, scheduleLabel } from '../domain/card';
import type { StoredRecurringItem } from '../domain/item';
import { recurringStrings } from './strings.es-CO';

const ICONS: Partial<Record<CategoryId, IconName>> = {
  rent: 'home',
  utilities: 'bolt',
  telecom: 'phone',
  subscriptions: 'play',
  transport: 'bus',
  gym: 'gym',
  health: 'shield',
  education: 'goal',
};

const TONES = {
  today: 'accent',
  soon: 'accent',
  paid: 'info',
  upcoming: 'neutral',
  none: 'neutral',
} as const satisfies Record<ReturnType<typeof chargeState>['kind'], BadgeTone>;

export interface RecurringCardProps {
  item: StoredRecurringItem;
  today: IsoDate;
  onPress: (item: StoredRecurringItem) => void;
}

export function RecurringCard({ item, today, onPress }: RecurringCardProps) {
  const styles = useThemedStyles(createStyles);
  const state = chargeState(item.schedule, today);
  const stateLabel = chargeLabel(state);
  const schedule = scheduleLabel(item.schedule);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={recurringStrings.billetera.cardLabel(
        item.name,
        formatCop(item.amountMinor),
        schedule,
        stateLabel,
      )}
      testID={`recurring.card.${item.id}`}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.row}>
        <IconTile icon={ICONS[item.categoryId] ?? 'card'} tone="soft" size={26} />
        <AppText variant="captionStrong" numberOfLines={1} style={styles.name}>
          {item.name}
        </AppText>
      </View>
      <View style={styles.row}>
        <AmountText amountMinor={item.amountMinor} size={13} />
        <Badge label={PERIODICITY_LABEL[item.schedule.periodicity]} size="sm" />
      </View>
      <View style={styles.bottom}>
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.schedule}>
          {schedule}
        </AppText>
        {stateLabel ? (
          <Badge
            label={stateLabel}
            tone={TONES[state.kind]}
            size="sm"
            testID={`recurring.card.${item.id}.state`}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      flexBasis: '48%',
      flexGrow: 1,
      minWidth: 0,
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.tileLg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    pressed: { opacity: 0.8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0 },
    name: { flexShrink: 1, fontSize: 12, lineHeight: 16 },
    bottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    schedule: { fontSize: 10, lineHeight: 13, flexShrink: 1 },
  });
