// One row of "Otros gastos" (design Billetera, `.row`): lime icon tile, name with the "Poco uso"
// pill, "Renueva 28 sep" and the amount. Tapping it opens Detalle de suscripción.
// With the account or card from M6: "Tarjeta de crédito · renueva 28 sep".
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import type { IsoDate } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Badge,
  IconTile,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { dayMonth } from '../domain/card';
import type { StoredRecurringItem } from '../domain/item';
import { nextCharge } from '../domain/schedule';
import { PriceUpChip } from './PriceUpChip';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.billetera;

export interface SubscriptionRowProps {
  item: StoredRecurringItem;
  today: IsoDate;
  /** "Tarjeta de crédito": the kind of account it is charged to, when known. */
  account?: string | null;
  /** An open price alert: the red "Subió" chip (SCRUM-61). */
  priceUp?: boolean;
  onPress: (item: StoredRecurringItem) => void;
}

export function SubscriptionRow({ item, today, account, priceUp, onPress }: SubscriptionRowProps) {
  const styles = useThemedStyles(createStyles);
  const next = nextCharge(item.schedule, today);
  const renews = next
    ? account
      ? t.renewsFrom(account, dayMonth(next))
      : t.renews(dayMonth(next))
    : (account ?? '');
  const lowUse = item.usage === 'low';
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={[
        item.name,
        lowUse ? t.lowUse : '',
        priceUp ? recurringStrings.priceUp.chip : '',
        renews,
        formatCop(item.amountMinor),
      ]
        .filter(Boolean)
        .join(', ')}
      testID={`recurring.subscription.${item.id}`}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <IconTile icon="play" tone="accent" size={40} />
      <View style={styles.texts}>
        <View style={styles.titleLine}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {item.name}
          </AppText>
          {lowUse ? <Badge label={t.lowUse} tone="success" size="md" /> : null}
          {priceUp ? <PriceUpChip /> : null}
        </View>
        {renews ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {renews}
          </AppText>
        ) : null}
      </View>
      <AmountText amountMinor={item.amountMinor} size={14} />
    </Pressable>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.button,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    pressed: { opacity: 0.8 },
    texts: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    title: { flexShrink: 1 },
  });
