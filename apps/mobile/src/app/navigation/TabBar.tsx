// Bottom tab bar of the design (VerdeDashboard `nav`): light blue bar with rounded top corners,
// four tabs, the active one white with a filled icon and a dot above it, inactive ones at 72 %
// white, and a white notch under the active tab. The tabs also switch with a horizontal swipe
// (MainTabs), and the notch follows the finger through the pager's `position`.
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { TabName } from '@shared/navigation';
import {
  Icon,
  fonts,
  radius,
  size,
  uiStrings,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

const ICONS: Record<TabName, { idle: IconName; active: IconName }> = {
  Dashboard: { idle: 'tabDashboard', active: 'tabDashboardActive' },
  Billetera: { idle: 'tabWallet', active: 'tabWalletActive' },
  Recomendaciones: { idle: 'tabRecommendations', active: 'tabRecommendationsActive' },
  Inversion: { idle: 'tabInvestment', active: 'tabInvestmentActive' },
};

export const TAB_LABELS: Record<TabName, string> = {
  Dashboard: uiStrings.tabs.dashboard,
  Billetera: uiStrings.tabs.wallet,
  Recomendaciones: uiStrings.tabs.recommendations,
  Inversion: uiStrings.tabs.investment,
};

// Bar padding 8 px, gap 4 px, notch 66 px wide (design values).
const PADDING = 8;
const GAP = 4;
const NOTCH_WIDTH = 66;

/** Left position of the notch under the tab at `index` (fractional while swiping). */
export function notchLeft(barWidth: number, tabs: number, index: number): number {
  const tabWidth = (barWidth - PADDING * 2 - GAP * (tabs - 1)) / tabs;
  const center = PADDING + index * (tabWidth + GAP) + tabWidth / 2;
  return center - NOTCH_WIDTH / 2;
}

export function TabBar({ state, navigation, position }: MaterialTopTabBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState<number>(size.screenWidth);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const indexes = state.routes.map((_, i) => i);
  const notchX = position.interpolate({
    inputRange: indexes,
    outputRange: indexes.map((i) => notchLeft(width, state.routes.length, i)),
    extrapolate: 'clamp',
  });

  return (
    <View
      onLayout={onLayout}
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(18, insets.bottom) }]}
    >
      {state.routes.map((route, index) => {
        const name = route.name as TabName;
        const focused = state.index === index;
        const label = TAB_LABELS[name];
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            testID={`tab-${name}`}
            style={styles.item}
          >
            <View style={styles.iconBox}>
              {focused ? <View style={styles.dot} /> : null}
              <Icon
                name={focused ? ICONS[name].active : ICONS[name].idle}
                size={22}
                color={focused ? colors.onPrimary : colors.onPrimaryMuted}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                focused
                  ? { color: colors.onPrimary, fontFamily: fonts.body.bold }
                  : { color: colors.onPrimaryMuted, fontFamily: fonts.body.semibold },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[styles.notch, { transform: [{ translateX: notchX }] }]}
        testID="tab-notch"
      >
        <Svg width={NOTCH_WIDTH} height={13} viewBox="0 0 46 13" preserveAspectRatio="none">
          <Path
            d="M0 13C9 13 13.5 9.5 17.5 4.2 19.8 1.2 21.2 0 23 0s3.2 1.2 5.5 4.2C32.5 9.5 37 13 46 13Z"
            fill={colors.onPrimary}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// The bar, its icons and the white notch are drawn on blue: the same colors in both themes.
const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      gap: GAP,
      paddingTop: PADDING,
      paddingHorizontal: PADDING,
      minHeight: size.tabBar,
      backgroundColor: colors.primaryLight,
      borderTopLeftRadius: radius.button,
      borderTopRightRadius: radius.button,
      overflow: 'hidden',
      ...shadow.tabBar,
    },
    item: { flex: 1, alignItems: 'center', gap: 4 },
    iconBox: { width: 52, height: 32, alignItems: 'center', justifyContent: 'center' },
    dot: {
      position: 'absolute',
      top: -4,
      left: 26 - 2.5,
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimary,
    },
    label: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
    notch: { position: 'absolute', bottom: 0, left: 0 },
  });
