// The connected accounts as in OnbCuentas.html: logo tile, name, "<tipo> · ✓ Conectada", balance.
// Used after linking (Conectar banco) and by onboarding step 3 (M3).
import { StyleSheet, View } from 'react-native';

import type { MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Icon,
  IconTile,
  fonts,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { bankStrings } from './strings.es-CO';

const t = bankStrings.list;

export interface BankLinkListItem {
  id: string;
  displayName: string;
  kind: keyof typeof t.kind;
  balanceMinor: MoneyMinor;
}

export function BankLinkList({ items }: { items: readonly BankLinkListItem[] }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.list} testID="bank.linkList">
      {items.map((item) => (
        <View
          key={item.id}
          style={styles.row}
          testID={`bank.linkList.${item.id}`}
          accessible
          accessibilityLabel={`${item.displayName}, ${t.kind[item.kind]}, ${t.connected}`}
        >
          <IconTile icon={item.kind === 'wallet' ? 'tabWallet' : 'bank'} tone="soft" size={40} />
          <View style={styles.names}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {item.displayName}
            </AppText>
            <View style={styles.subtitle}>
              <AppText variant="caption" color="textSecondary">
                {`${t.kind[item.kind]} · `}
              </AppText>
              <Icon name="check" size={12} color={colors.link} strokeWidth={3} />
              <AppText variant="caption" color="link" style={styles.connected}>
                {t.connected}
              </AppText>
            </View>
          </View>
          <AmountText amountMinor={item.balanceMinor} size={14} weight="semibold" />
        </View>
      ))}
    </View>
  );
}

// Sizes from OnbCuentas.html: gap 8 between rows; each row padding 8/16, radius 16, a 1 px blue
// border and the shadow 0 6px 16px -12px of the ink color at 20 %.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    list: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 6 },
      elevation: 1,
    },
    names: { flex: 1, minWidth: 0, gap: 2 },
    subtitle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    connected: { fontFamily: fonts.body.bold },
  });
