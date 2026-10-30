// Detalle de cuentas (design DashboardDetalles): the Dashboard header expands in place to one
// row per account. The tab under it opens and closes it by tap, or by dragging it down or up.
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import {
  AmountText,
  AppText,
  Badge,
  Icon,
  fontSize,
  radius,
  spacing,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { AccountRow } from '../domain/dashboard';
import { maskedNumber } from '../domain/masking';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.dashboard;

/** "Cuenta de ahorros · •• 4821", or "Registrado manualmente" for cash. Never more than 4 digits. */
export function rowDetail(row: AccountRow): string {
  if (row.kind === 'cash') return t.cashDetail;
  const masked = maskedNumber(row.last4);
  return [accountsStrings.kinds[row.kind], masked].filter(Boolean).join(' · ');
}

export function AccountsPanel({
  rows,
  onPressRow,
}: {
  rows: AccountRow[];
  /** Opens Detalle de cuenta. */
  onPressRow: (id: AccountRow['id']) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.panel} testID="accounts.panel">
      {rows.length === 0 ? (
        <AppText variant="small" color="onPrimary">
          {t.noAccounts}
        </AppText>
      ) : null}
      {rows.map((row) => (
        <Pressable
          key={row.id}
          onPress={() => onPressRow(row.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          testID={`accounts.row.${row.id}`}
        >
          <View style={styles.names}>
            <View style={styles.entity}>
              <AppText
                variant="label"
                color="onPrimary"
                style={styles.entityText}
                numberOfLines={1}
              >
                {row.entity}
              </AppText>
              {row.isSimulated ? (
                <Badge label={uiStrings.simulated} tone="onPrimary" size="sm" />
              ) : null}
            </View>
            <AppText variant="caption" color="onPrimary" style={styles.detail} numberOfLines={1}>
              {rowDetail(row)}
            </AppText>
          </View>
          <AmountText amountMinor={row.amountMinor} size={13} color="onPrimary" />
        </Pressable>
      ))}
    </View>
  );
}

/** What a drag on the tab does: down opens, up closes, a short drag does nothing. */
export function dragIntent(translationY: number, expanded: boolean): 'open' | 'close' | null {
  if (!expanded && translationY > 24) return 'open';
  if (expanded && translationY < -24) return 'close';
  return null;
}

const TAB_PATH = 'M0 0C15 0 22 3.5 28 8.8 31.5 11.8 34.5 13 37 13s5.5-1.2 9-4.2C52 3.5 59 0 74 0Z';

export function DetailsTab({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetY: [-10, 10],
    onDeactivate: (e) => {
      if (dragIntent(e.translationY, expanded)) onToggle();
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? t.hideDetails : t.showDetails}
        accessibilityState={{ expanded }}
        style={[styles.tab, { marginTop: expanded ? -(spacing.screen + 1) : -12 }]}
        hitSlop={8}
        testID="accounts.detailsTab"
      >
        <Svg width={148} height={26} viewBox="0 0 74 13" preserveAspectRatio="none">
          <Path d={TAB_PATH} fill={expanded ? colors.accountsPanel : colors.pullTab} />
        </Svg>
        <View style={[styles.chevron, expanded && styles.flipped]}>
          <Icon name="chevronDown" size={16} strokeWidth={3.2} color={colors.onPrimary} />
        </View>
      </Pressable>
    </GestureDetector>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    panel: {
      marginTop: spacing.md,
      borderRadius: radius.card,
      backgroundColor: colors.accountsPanel,
      padding: 16,
      gap: spacing.md,
    },
    row: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    names: { flex: 1, minWidth: 0 },
    entity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    entityText: { lineHeight: 18, flexShrink: 1 },
    detail: { fontSize: fontSize[11], lineHeight: 14, opacity: 0.85 },
    tab: { alignSelf: 'center', width: 148, height: 24, zIndex: 2, elevation: 2 },
    chevron: { position: 'absolute', left: 66, top: 4 },
    flipped: { transform: [{ rotate: '180deg' }] },
    pressed: { opacity: 0.8 },
  });
