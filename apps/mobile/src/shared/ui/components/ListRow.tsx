// List row of the design: icon tile, title, subtitle, and an amount or a chevron at the end
// ("Movimientos" of VerdeDashboard, "Gestión de cuenta" of VerdeDetalleCuentas).
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MoneyMinor } from '../../domain/types';
import { Icon, type IconName } from '../icons';
import { colors, radius } from '../tokens';
import { AmountText } from './AmountText';
import { AppText } from './AppText';
import { IconTile, type IconTileSize, type IconTileTone } from './IconTile';

export type ListRowTrailing =
  | { kind: 'amount'; amountMinor: MoneyMinor; signed?: boolean }
  | { kind: 'chevron' }
  | { kind: 'custom'; node: ReactNode };

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: IconTileTone;
  iconSize?: IconTileSize;
  /** Shown next to the title, e.g. <Badge label="Poco uso" />. */
  badge?: ReactNode;
  trailing?: ListRowTrailing;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'outline',
  iconSize = 44,
  badge,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      {icon ? <IconTile icon={icon} tone={iconTone} size={iconSize} /> : null}
      <View style={styles.texts}>
        <View style={styles.titleLine}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          {badge}
        </View>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing?.kind === 'amount' ? (
        <AmountText amountMinor={trailing.amountMinor} signed={trailing.signed} size={14} />
      ) : null}
      {trailing?.kind === 'chevron' ? (
        <Icon name="chevronRight" size={18} color={colors.textPlaceholder} strokeWidth={2.2} />
      ) : null}
      {trailing?.kind === 'custom' ? trailing.node : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.input,
  },
  pressed: { backgroundColor: colors.surfaceBlueSoft },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
});
