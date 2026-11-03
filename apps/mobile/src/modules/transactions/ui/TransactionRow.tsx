// A movement row. The design draws it three ways:
//   list    Movimientos `.row`: 40 px tile (light blue for money out, lime with the down arrow
//           for money in), "<categoría> · <cuenta>", a divider between rows of a day.
//   preview Dashboard "Movimientos": 48 px outlined tile, 24 px icon, never lime,
//           "<cuenta> · <fecha>".
//   account CuentaDetalle: 40 px tile with radius 11 on the stronger light blue, 14 px title,
//           "<fecha> · <categoría>", money in drawn in lime.
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

export type TransactionRowVariant = 'list' | 'preview' | 'account';

export interface TransactionRowProps {
  tx: Transaction;
  title: string;
  subtitle: string;
  variant?: TransactionRowVariant;
  /** Only in the list: false for the first row of a day, which has no divider on top. */
  divider?: boolean;
  onPress?: (tx: Transaction) => void;
}

export function TransactionRow({
  tx,
  title,
  subtitle,
  variant = 'list',
  divider = false,
  onPress,
}: TransactionRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const income = tx.amountMinor > 0;
  const lime = income && variant !== 'preview';
  return (
    <Pressable
      onPress={onPress ? () => onPress(tx) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={s.list.rowLabel(title, formatCopSigned(tx.amountMinor))}
      testID={`transactions.row.${tx.id}`}
      style={({ pressed }) => [
        styles.row,
        variant === 'preview' ? styles.rowPreview : null,
        variant === 'account' ? styles.rowAccount : null,
        divider && variant === 'list' ? styles.divider : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        style={[
          styles.tile,
          variant === 'preview' ? styles.tilePreview : null,
          variant === 'account' ? styles.tileAccount : null,
          lime ? styles.tileIncome : null,
        ]}
      >
        <Icon
          name={iconOf(tx.categoryId, tx.amountMinor)}
          size={variant === 'preview' ? 24 : 16}
          strokeWidth={2}
          color={lime ? colors.accentText : colors.primaryDark}
        />
      </View>
      <View style={[styles.texts, variant === 'preview' ? styles.textsPreview : null]}>
        <AppText variant={variant === 'account' ? 'label' : 'bodyStrong'} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <AmountText
        amountMinor={tx.amountMinor}
        signed
        size={14}
        color={variant === 'account' && income ? 'accentText' : undefined}
      />
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
    rowPreview: { marginHorizontal: -8 },
    rowAccount: { borderRadius: radius.tile },
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
    tilePreview: {
      width: 48,
      height: 48,
      borderRadius: radius.tileLg,
      borderWidth: 1,
      borderColor: colors.borderBlue,
    },
    tileAccount: { borderRadius: 11, backgroundColor: colors.surfaceBlue },
    tileIncome: { backgroundColor: colors.accentTint },
    texts: { flex: 1, minWidth: 0 },
    textsPreview: { gap: 2 },
  });
