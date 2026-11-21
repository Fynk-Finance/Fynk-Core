// Blue header with rounded bottom corners (VerdeDashboard, VerdeBilletera, VerdeRecomendaciones):
// avatar with initials, "Hola," and the name, and the bell with a lime dot when there is
// something unread. Every tab adds the Estadísticas chart button left of the bell (the design has
// it only on the Dashboard; QA review 2026-11-07, V9). An optional title row and extra content go
// below.
//
// The parts are exported so the tabs' shared header (QA review 2026-11-07, G2) draws the same
// pixels: HeaderBlueFrame is the blue card, HeaderGreetingRow the avatar, greeting and buttons, and
// HeaderBlueContent the title row and the extra content.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { Icon } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { radius, size, spacing } from '../tokens';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

export interface HeaderGreetingRowProps {
  name: string;
  hasUnread?: boolean;
  onPressAccount?: () => void;
  onPressNotifications?: () => void;
  /** The chart button that opens Estadísticas, shown only when set (every tab). */
  onPressStatistics?: () => void;
  /** Light avatar of the Inversión header. */
  avatarTone?: 'primary' | 'light';
  /** Drawn instead of the avatar, e.g. two avatars fading into each other between tabs. */
  avatar?: ReactNode;
}

export interface HeaderBlueContentProps {
  title?: string;
  subtitle?: string;
  /** Right side of the title row, e.g. the month's total in Billetera. */
  trailing?: ReactNode;
  /** Extra content inside the blue area, below the title row. */
  children?: ReactNode;
}

export interface HeaderBlueProps
  extends Omit<HeaderGreetingRowProps, 'avatar'>, HeaderBlueContentProps {
  /** Decorative rounded squares of the design (Mi cuenta, onboarding). */
  decorated?: boolean;
  /** The Dashboard header, a muted blue in dark mode (`headerDashboard`). */
  dashboard?: boolean;
}

/** Height of the greeting row: the 38 px avatar with 5 px around it, as tall as the bell. */
const ROW_HEIGHT = size.iconButton;

/** Distance from the top of the header to its content below the greeting row. */
export function headerContentTop(insetTop: number): number {
  'worklet';
  return insetTop + spacing.screen + ROW_HEIGHT + spacing.xl;
}

/** Height of the whole header for content of `contentHeight` px (0 without content). */
export function headerBlueHeight(insetTop: number, contentHeight: number): number {
  'worklet';
  if (contentHeight <= 0) return insetTop + spacing.screen + ROW_HEIGHT + spacing.screen;
  return headerContentTop(insetTop) + contentHeight + spacing.screen;
}

export function HeaderBlue({
  name,
  hasUnread,
  onPressAccount,
  onPressNotifications,
  onPressStatistics,
  avatarTone,
  title,
  subtitle,
  trailing,
  children,
  decorated = false,
  dashboard = false,
}: HeaderBlueProps) {
  const hasContent = !!title || (children != null && children !== false);
  return (
    <HeaderBlueFrame decorated={decorated} dashboard={dashboard}>
      <HeaderGreetingRow
        name={name}
        hasUnread={hasUnread}
        onPressAccount={onPressAccount}
        onPressNotifications={onPressNotifications}
        onPressStatistics={onPressStatistics}
        avatarTone={avatarTone}
      />
      {hasContent ? (
        <HeaderBlueContent title={title} subtitle={subtitle} trailing={trailing}>
          {children}
        </HeaderBlueContent>
      ) : null}
    </HeaderBlueFrame>
  );
}

/** The blue card: shadow, top inset, side and bottom padding, 12 px between its rows. */
export function HeaderBlueFrame({
  children,
  decorated = false,
  dashboard = false,
}: {
  children: ReactNode;
  decorated?: boolean;
  dashboard?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shadow}>
      <View
        style={[
          styles.blue,
          {
            paddingTop: insets.top + spacing.screen,
            ...(dashboard ? { backgroundColor: colors.headerDashboard } : null),
          },
        ]}
      >
        {decorated ? (
          <Svg width={390} height={257} viewBox="0 0 390 257" style={StyleSheet.absoluteFill}>
            <Rect x={268} y={-70} width={190} height={190} rx={44} fill={colors.headerShapeA} />
            <Rect x={320} y={-26} width={96} height={96} rx={24} fill={colors.headerShapeB} />
            <Rect x={-56} y={150} width={140} height={140} rx={34} fill={colors.primaryPressed} />
          </Svg>
        ) : null}
        {children}
      </View>
    </View>
  );
}

export function HeaderGreetingRow({
  name,
  hasUnread = false,
  onPressAccount,
  onPressNotifications,
  onPressStatistics,
  avatarTone = 'primary',
  avatar,
}: HeaderGreetingRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const bell = (
    <Pressable
      onPress={onPressNotifications}
      disabled={!onPressNotifications}
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? uiStrings.notificationsUnread : uiStrings.notifications}
      style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
      testID="header-bell"
    >
      <Icon name="bell" size={22} color={colors.onPrimary} />
      {hasUnread ? <View style={styles.dot} testID="header-unread-dot" /> : null}
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPressAccount}
        disabled={!onPressAccount}
        accessibilityRole="button"
        accessibilityLabel={uiStrings.myAccount(name)}
        style={({ pressed }) => [styles.account, pressed && styles.pressed]}
      >
        {avatar ?? <Avatar name={name} tone={avatarTone} />}
        <View style={styles.greeting}>
          <AppText variant="caption" color="onPrimary" style={styles.hello}>
            {uiStrings.greeting}
          </AppText>
          <AppText variant="bodyStrong" color="onPrimary" style={styles.name} numberOfLines={1}>
            {name}
          </AppText>
        </View>
      </Pressable>
      {onPressStatistics ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onPressStatistics}
            accessibilityRole="button"
            accessibilityLabel={uiStrings.statistics}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
            testID="header-statistics"
          >
            <Icon name="chartBars" size={22} color={colors.onPrimary} />
          </Pressable>
          {bell}
        </View>
      ) : (
        bell
      )}
    </View>
  );
}

/** The title row and the extra content, 12 px apart. */
export function HeaderBlueContent({ title, subtitle, trailing, children }: HeaderBlueContentProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.content}>
      {title ? (
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText variant="screenTitle" color="onPrimary">
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="small" color="onPrimary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    shadow: { ...shadow.header, zIndex: 1 },
    blue: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      paddingHorizontal: spacing.screen,
      paddingBottom: spacing.screen,
      gap: spacing.xl,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 5,
      paddingLeft: 5,
      paddingRight: 16,
      borderRadius: radius.pill,
      flexShrink: 1,
    },
    greeting: { gap: 1, flexShrink: 1 },
    hello: { lineHeight: 14, opacity: 0.85 },
    name: { lineHeight: 18 },
    bell: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      position: 'absolute',
      top: 11,
      right: 12,
      width: 9,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    pressed: { opacity: 0.8 },
    content: { gap: spacing.xl },
    titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    titleText: { gap: spacing.xs, flexShrink: 1 },
    subtitle: { opacity: 0.92 },
  });
