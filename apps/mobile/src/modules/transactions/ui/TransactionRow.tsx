// A movement row of Movimientos (`.row`): 40 px tile (light blue for money out, lime with the
// down arrow for money in), title, "<categoría> · <cuenta>" and the signed amount. Rows after
// the first of a day have a divider on top.
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCopSigned } from '@shared/domain/money';
import type { Transaction } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Icon,
  radius,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { iconOf } from './categoryIcons';
import { transactionsStrings as s } from './strings.es-CO';

export interface TransactionRowProps {
  tx: Transaction;
  title: string;
  subtitle: string;
  /** False for the first row of a day: it has no divider on top. */
  divider?: boolean;
  onPress?: (tx: Transaction) => void;
}

export function TransactionRow({
  tx,
  title,
  subtitle,
  divider = false,
  onPress,
}: TransactionRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const income = tx.amountMinor > 0;
  return (
    <Pressable
      onPress={onPress ? () => onPress(tx) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={s.list.rowLabel(title, formatCopSigned(tx.amountMinor))}
      testID={`transactions.row.${tx.id}`}
      style={({ pressed }) => [
        styles.row,
        divider ? styles.divider : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.tile, income ? styles.tileIncome : null]}>
        <Icon
          name={iconOf(tx.categoryId, tx.amountMinor)}
          size={16}
          strokeWidth={2}
          color={income ? colors.accentText : colors.primaryDark}
        />
      </View>
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <AmountText amountMinor={tx.amountMinor} signed size={14} />
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      borderRadius: radius.input,
      backgroundColor: colors.background,
    },
    divider: { borderTopWidth: 1, borderTopColor: colors.divider },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
    tile: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceBlueSoft,
    },
    tileIncome: { backgroundColor: colors.accentTint },
    texts: { flex: 1, minWidth: 0 },
  });
