// Blue header with rounded bottom corners (VerdeDashboard, VerdeBilletera, VerdeRecomendaciones):
// avatar with initials, "Hola," and the name, and the bell with a lime dot when there is
// something unread. An optional title row and extra content go below.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { Icon } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { colors, radius, shadow, size, spacing } from '../tokens';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

export interface HeaderBlueProps {
  name: string;
  hasUnread?: boolean;
  onPressAccount?: () => void;
  onPressNotifications?: () => void;
  title?: string;
  subtitle?: string;
  /** Right side of the title row, e.g. the month's total in Billetera. */
  trailing?: ReactNode;
  /** Extra content inside the blue area, below the title row. */
  children?: ReactNode;
  /** Decorative rounded squares of the design (Mi cuenta, onboarding). */
  decorated?: boolean;
  /** Light avatar of the Inversión header. */
  avatarTone?: 'primary' | 'light';
}

export function HeaderBlue({
  name,
  hasUnread = false,
  onPressAccount,
  onPressNotifications,
  title,
  subtitle,
  trailing,
  children,
  decorated = false,
  avatarTone = 'primary',
}: HeaderBlueProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shadow}>
      <View style={[styles.blue, { paddingTop: insets.top + spacing.screen }]}>
        {decorated ? (
          <Svg width={390} height={257} viewBox="0 0 390 257" style={StyleSheet.absoluteFill}>
            <Rect x={268} y={-70} width={190} height={190} rx={44} fill={colors.headerShapeA} />
            <Rect x={320} y={-26} width={96} height={96} rx={24} fill={colors.headerShapeB} />
            <Rect x={-56} y={150} width={140} height={140} rx={34} fill={colors.primaryPressed} />
          </Svg>
        ) : null}
        <View style={styles.row}>
          <Pressable
            onPress={onPressAccount}
            disabled={!onPressAccount}
            accessibilityRole="button"
            accessibilityLabel={uiStrings.myAccount(name)}
            style={({ pressed }) => [styles.account, pressed && styles.pressed]}
          >
            <Avatar name={name} tone={avatarTone} />
            <View style={styles.greeting}>
              <AppText variant="caption" color="white" style={styles.hello}>
                {uiStrings.greeting}
              </AppText>
              <AppText variant="bodyStrong" color="white" style={styles.name} numberOfLines={1}>
                {name}
              </AppText>
            </View>
          </Pressable>
          <Pressable
            onPress={onPressNotifications}
            disabled={!onPressNotifications}
            accessibilityRole="button"
            accessibilityLabel={hasUnread ? uiStrings.notificationsUnread : uiStrings.notifications}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
            testID="header-bell"
          >
            <Icon name="bell" size={22} color={colors.white} />
            {hasUnread ? <View style={styles.dot} testID="header-unread-dot" /> : null}
          </Pressable>
        </View>
        {title ? (
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <AppText variant="screenTitle" color="white">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="small" color="white" style={styles.subtitle}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            {trailing}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  titleText: { gap: spacing.xs, flexShrink: 1 },
  subtitle: { opacity: 0.92 },
});
