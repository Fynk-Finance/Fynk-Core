// Detalle de cuentas (design DashboardDetalles): the Dashboard header expands in place to one
// row per account. The tab under it opens and closes it by tap; dragging the header opens and
// closes it gradually (DashboardScreen, G1).
// Until a bank account is connected, a ghost of an account card invites to connect one (QA review
// 2026-11-07, V5; new state, needs design review).
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  AmountText,
  AppText,
  Badge,
  GhostCard,
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
export function rowDetail(row: Pick<AccountRow, 'kind' | 'last4'>): string {
  if (row.kind === 'cash') return t.cashDetail;
  const masked = maskedNumber(row.last4);
  return [accountsStrings.kinds[row.kind], masked].filter(Boolean).join(' · ');
}

export function AccountsPanel({
  rows,
  onPressRow,
  onConnect,
}: {
  rows: AccountRow[];
  /** Opens Detalle de cuenta. */
  onPressRow: (id: AccountRow['id']) => void;
  /** Set while no bank account is connected: the ghost card's "Conectar cuenta" opens M5. */
  onConnect?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.panel} testID="accounts.panel">
      {rows.length === 0 && !onConnect ? (
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
      {onConnect ? (
        <GhostCard
          actionLabel={t.connectAccount}
          message={t.noAccounts}
          onAction={onConnect}
          onPrimary
          testID="accounts.panel.ghost"
        />
      ) : null}
    </View>
  );
}

const TAB_PATH = 'M0 0C15 0 22 3.5 28 8.8 31.5 11.8 34.5 13 37 13s5.5-1.2 9-4.2C52 3.5 59 0 74 0Z';

/**
 * The tab is bigger than the design's 148 × 24, which was too small to hit (QA review
 * 2026-11-07, G1). Its shape is the design's, stretched.
 */
const TAB_WIDTH = 176;
export const TAB_HEIGHT = 30;
const CHEVRON = 20;

export function DetailsTab({
  expanded,
  onToggle,
  openness,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** 0 closed, 1 open: the chevron turns with it while the header is dragged. */
  openness?: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(openness ? openness.value : expanded ? 1 : 0) * 180}deg` }],
  }));
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={expanded ? t.hideDetails : t.showDetails}
      accessibilityState={{ expanded }}
      style={styles.tab}
      hitSlop={{ top: 8, bottom: 16, left: 16, right: 16 }}
      testID="accounts.detailsTab"
    >
      <Svg width={TAB_WIDTH} height={TAB_HEIGHT + 2} viewBox="0 0 74 13" preserveAspectRatio="none">
        <Path d={TAB_PATH} fill={colors.headerDashboard} testID="accounts.detailsTab.shape" />
      </Svg>
      <Animated.View style={[styles.chevron, chevronStyle]}>
        <Icon name="chevronDown" size={CHEVRON} strokeWidth={3.2} color={colors.onPrimary} />
      </Animated.View>
    </Pressable>
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
    // Hangs below the header, open or closed, in the header's blue: 1 px up hides the seam
    // (design Dashboard and DashboardDetalles PNGs; QA review 2026-11-07, V3).
    tab: {
      alignSelf: 'center',
      width: TAB_WIDTH,
      height: TAB_HEIGHT,
      marginTop: -1,
      zIndex: 2,
      elevation: 2,
    },
    chevron: { position: 'absolute', left: (TAB_WIDTH - CHEVRON) / 2, top: 5 },
    pressed: { opacity: 0.8 },
  });
