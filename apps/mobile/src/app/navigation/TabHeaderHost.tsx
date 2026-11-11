// The tabs' shared blue header (QA review 2026-11-07, G2, SCRUM-89), drawn once above the pager.
// While the pages slide, the card stays in place and its height follows the pager from one tab's
// header to the next; the greeting row never moves; each tab's own content fades out by the middle
// of the swipe and the next one fades in. In dark mode the Dashboard's muted blue fades in and out
// the same way. With Reduce Motion everything switches at once. A sideways flick on the header
// switches tab, since the header sits outside the pager and cannot drag it.
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  blend,
  fillUnknown,
  flickTarget,
  layerOpacity,
  nearestTab,
  UNKNOWN,
  useTabHeaderBridge,
  type TabHeaderBridge,
  type TabHeaderEntry,
} from '@shared/navigation';
import {
  Avatar,
  HeaderGreetingRow,
  headerBlueHeight,
  headerContentTop,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

/** A tab seen for the first time eases to its height like the design's reveals (.38s). */
const SETTLE = { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export function TabHeaderHost() {
  const bridge = useTabHeaderBridge();
  if (!bridge || bridge.shared.size === 0) return null;
  return <Host bridge={bridge} />;
}

function Host({ bridge }: { bridge: TabHeaderBridge }) {
  const { tabs, shared, store, position, heights, jumpTo } = bridge;
  const { entries, focused } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const top = insets.top;

  const entryAt = (i: number) => {
    const tab = tabs[i];
    return tab ? entries.get(tab) : undefined;
  };
  const sources = tabs.map(
    (tab) => entries.get(tab)?.contentHeight ?? (heights.get(tab) as SharedValue<number>),
  );
  const flags = (pick: (entry: TabHeaderEntry) => boolean) =>
    tabs.map((tab) => {
      const entry = entries.get(tab);
      return entry && pick(entry) ? 1 : 0;
    });
  const sharedFlags = tabs.map((tab) => (shared.has(tab) ? 1 : 0));
  const dashboardFlags = flags((entry) => entry.chrome.dashboard);
  const lightFlags = flags((entry) => entry.chrome.avatarTone === 'light');
  const offsets = tabs.map((tab) => entries.get(tab)?.offsetY ?? null);

  // A tab with only the greeting has no content to measure.
  useEffect(() => {
    entries.forEach((entry, tab) => {
      const height = heights.get(tab);
      if (height && !entry.content && !entry.contentHeight) height.value = 0;
    });
  }, [entries, heights]);

  const cardHeight = useDerivedValue(() => {
    const totals = sources.map((source) =>
      source.value === UNKNOWN ? UNKNOWN : headerBlueHeight(top, source.value),
    );
    return blend(position.value, fillUnknown(totals), reduceMotion);
  });
  const rootStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: blend(
          position.value,
          offsets.map((offset) => offset?.value ?? 0),
          reduceMotion,
        ),
      },
    ],
  }));
  // The fade toward a tab with its own header goes on the card itself, not on a parent: Android
  // draws an elevation shadow with the view's own opacity only, so a parent's fade left the
  // shadow behind.
  const cardStyle = useAnimatedStyle(() => ({
    height: cardHeight.value,
    opacity: blend(position.value, sharedFlags, reduceMotion),
  }));
  const dashboardStyle = useAnimatedStyle(() => ({
    opacity: blend(position.value, dashboardFlags, reduceMotion),
  }));
  const lightAvatarStyle = useAnimatedStyle(() => ({
    opacity: blend(position.value, lightFlags, reduceMotion),
  }));

  const jump = (index: number) => jumpTo(index);
  const count = tabs.length;
  const flick = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-10, 10],
    onDeactivate: (e) => {
      'worklet';
      const target = flickTarget(
        nearestTab(position.value, count),
        count,
        e.translationX,
        e.velocityX,
      );
      if (target !== null) runOnJS(jump)(target);
    },
  });

  // The focused tab's chrome; the same name and bell on every tab, so the row never jumps.
  const chrome = entryAt(focused)?.chrome ?? [...entries.values()][0]?.chrome;
  const focusedTab = tabs[focused];
  const focusedShared = !!focusedTab && shared.has(focusedTab);

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      pointerEvents={focusedShared ? 'box-none' : 'none'}
      testID="tab-header"
    >
      <GestureDetector gesture={flick}>
        <Animated.View style={[styles.card, cardStyle]} testID="tab-header.card">
          <View style={styles.clip}>
            <Animated.View style={[styles.fill, styles.dashboardFill, dashboardStyle]} />
            {chrome ? (
              <View style={[styles.row, { top: top + spacing.screen }]}>
                <HeaderGreetingRow
                  {...chrome}
                  avatar={
                    <View>
                      <Avatar name={chrome.name} />
                      <Animated.View style={[StyleSheet.absoluteFill, lightAvatarStyle]}>
                        <Avatar name={chrome.name} tone="light" />
                      </Animated.View>
                    </View>
                  }
                />
              </View>
            ) : null}
            {tabs.map((tab, i) => {
              const entry = entries.get(tab);
              if (!entry?.content) return null;
              return (
                <ContentLayer
                  key={tab}
                  index={i}
                  focused={focused === i}
                  top={headerContentTop(top)}
                  position={position}
                  reduceMotion={reduceMotion}
                  onHeight={
                    entry.contentHeight
                      ? undefined
                      : (h) => setHeight(bridge, tab, h, reduceMotion, i)
                  }
                >
                  {entry.content}
                </ContentLayer>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
      {tabs.map((tab, i) => {
        const below = entries.get(tab)?.below;
        return below ? (
          <BelowLayer
            key={`below-${tab}`}
            index={i}
            focused={focused === i}
            position={position}
            cardHeight={cardHeight}
            reduceMotion={reduceMotion}
          >
            {below}
          </BelowLayer>
        ) : null;
      })}
    </Animated.View>
  );
}

/** Stores a measured height. A tab's first height eases from the one it borrowed (fillUnknown). */
function setHeight(
  { tabs, heights }: TabHeaderBridge,
  tab: TabHeaderBridge['tabs'][number],
  measured: number,
  reduceMotion: boolean,
  index: number,
) {
  const height = heights.get(tab);
  if (!height || height.value === measured) return;
  const current = tabs.map((t) => heights.get(t)?.value ?? UNKNOWN);
  const firstTime = height.value === UNKNOWN;
  const othersKnown = current.some((value, i) => i !== index && value !== UNKNOWN);
  if (!firstTime || !othersKnown || reduceMotion) {
    height.value = measured;
    return;
  }
  height.value = fillUnknown(current)[index] ?? measured;
  height.value = withTiming(measured, SETTLE);
}

interface LayerProps {
  index: number;
  focused: boolean;
  position: SharedValue<number>;
  reduceMotion: boolean;
  children: ReactNode;
}

function ContentLayer({
  index,
  focused,
  top,
  position,
  reduceMotion,
  onHeight,
  children,
}: LayerProps & { top: number; onHeight?: (height: number) => void }) {
  const styles = useThemedStyles(createStyles);
  const style = useAnimatedStyle(() => ({
    opacity: layerOpacity(position.value, index, reduceMotion),
  }));
  const onLayout = onHeight
    ? (e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)
    : undefined;
  return (
    <Animated.View
      style={[styles.layer, { top }, style]}
      onLayout={onLayout}
      pointerEvents={focused ? 'box-none' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
      testID={`tab-header.content.${index}`}
    >
      {children}
    </Animated.View>
  );
}

function BelowLayer({
  index,
  focused,
  position,
  cardHeight,
  reduceMotion,
  children,
}: LayerProps & { cardHeight: SharedValue<number> }) {
  const styles = useThemedStyles(createStyles);
  const style = useAnimatedStyle(() => ({
    opacity: layerOpacity(position.value, index, reduceMotion),
    transform: [{ translateY: cardHeight.value }],
  }));
  return (
    <Animated.View
      style={[styles.below, style]}
      pointerEvents={focused ? 'box-none' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
      testID={`tab-header.below.${index}`}
    >
      {children}
    </Animated.View>
  );
}

// Same card as HeaderBlue: blue, rounded bottom corners, the header shadow.
const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    root: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
    card: {
      ...shadow.header,
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
    },
    clip: {
      ...StyleSheet.absoluteFill,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      overflow: 'hidden',
    },
    fill: StyleSheet.absoluteFill,
    dashboardFill: { backgroundColor: colors.headerDashboard },
    row: { position: 'absolute', left: spacing.screen, right: spacing.screen },
    layer: { position: 'absolute', left: spacing.screen, right: spacing.screen },
    below: { position: 'absolute', top: 0, left: 0, right: 0 },
  });
