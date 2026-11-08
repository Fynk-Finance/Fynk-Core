// Dashboard tab (design Dashboard, inventory rows 5 and 6), owned by M6: the blue header with
// "Hola, <nombre>", the chart icon that opens Estadísticas (M10) and the bell, the "Balance total"
// card and Detalle de cuentas, which expands in place. The header stays over the page and shrinks
// to a fifth of the screen while the page scrolls (QA review 2026-11-07, G3). Dragging the header
// down or up opens or closes Detalle de cuentas gradually, following the finger (G1). Below, Planes de
// ahorro (M8's carousel), Movimientos (M7's preview), and the FAB "Registrar gasto o ingreso",
// whose menu opens M7's sheet on Ingreso or Gasto.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ErrorState,
  Fab,
  HeaderBlue,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import { accountRows, type MonthSummary } from '../domain/dashboard';
import { ACCOUNT_DETAIL_ROUTE } from './AccountDetailScreen';
import { AccountsPanel, DetailsTab, TAB_HEIGHT } from './AccountsPanel';
import { DashboardBalanceCard } from './DashboardBalanceCard';
import { CARD_OPEN, collapse, compactCardHeight, HEADER_CHROME } from './dashboardCollapse';
import { dragOpenness, settleOpenness } from './detailsDrag';
import { FAB_BOTTOM, FabMenu } from './FabMenu';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.dashboard;

/** What the Detalle de cuentas tab adds below the header: its height, 1 px up. */
const TAB_OVERHANG = TAB_HEIGHT - 1;

/** Detalle de cuentas opens and settles like the design's reveals: .38s cubic-bezier(.22,1,.36,1). */
const SETTLE = { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export interface DashboardDeps {
  useAccounts: () => Pick<UseQueryResult<AccountsOverview>, 'data' | 'isError' | 'refetch'>;
  /** null while M10 computes the month. */
  useMonthSummary: () => MonthSummary | null;
  /** Unread notifications for the bell (M12). */
  useUnreadCount: () => number;
  useDisplayName: () => string | null;
  accountRoute: string;
  notificationsRoute: string;
  /** Estadísticas (M10), opened from the chart icon of the header. */
  statisticsRoute: string;
  /**
   * M5's Conectar banco, opened from the ghost card while no bank account is connected. Read at
   * press time.
   */
  connectRoute?: () => string;
  /** "Planes de ahorro" with the goals not reached yet (M8's GoalsCarousel). */
  renderGoals?: () => ReactNode;
  /** "Movimientos" with the latest movements (M7's TransactionPreview). */
  renderMovements?: () => ReactNode;
  /** The route of M7's "Registrar gasto o ingreso" sheet, opened with { kind }. Read at press time. */
  newMovementRoute?: () => string;
  /**
   * Pull to refresh (HU-011): M5's syncNow(). M5 keeps the 60 second cooldown; the accounts
   * are read again afterwards.
   */
  refresh?: () => Promise<unknown>;
}

export function createDashboardScreen(deps: DashboardDeps) {
  return function DashboardScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const [expanded, setExpanded] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const accounts = deps.useAccounts();
    const summary = deps.useMonthSummary();
    const unread = deps.useUnreadCount();
    const name = deps.useDisplayName() ?? t.guest;
    const overview = accounts.data;
    const connectRoute = deps.connectRoute;
    const onConnect =
      connectRoute && overview && overview.connectedCount === 0
        ? () => navigation.navigate(connectRoute())
        : undefined;

    // G3: the header sits over the page and shrinks while it scrolls (dashboardCollapse.ts).
    const cardClosed = compactCardHeight(windowHeight);
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const scrollY = useSharedValue(0);
    const open = useSharedValue(0);
    const panelHeight = useSharedValue(0);
    // The header without the card and the panel. This is the first guess; it is measured below.
    const chrome = useSharedValue(insets.top + HEADER_CHROME);
    const state = useDerivedValue(() =>
      collapse({
        scrollY: scrollY.value,
        cardClosed,
        panelHeight: panelHeight.value,
        panelOpen: open.value,
      }),
    );
    const onScroll = useAnimatedScrollHandler((e) => {
      scrollY.value = e.contentOffset.y;
    });
    // The page starts under the header at rest, so it stays attached while the header shrinks.
    const spacerStyle = useAnimatedStyle(() => ({
      height: chrome.value + CARD_OPEN + panelHeight.value * open.value + TAB_OVERHANG,
    }));
    const panelStyle = useAnimatedStyle(() => ({
      height: state.value.panel,
      opacity: open.value,
    }));
    const onHeaderLayout = (e: LayoutChangeEvent) => {
      if (scrollY.value > 0 || (open.value !== 0 && open.value !== 1)) return;
      chrome.value = e.nativeEvent.layout.height - state.value.card - state.value.panel;
    };
    const onPanelLayout = (e: LayoutChangeEvent) => {
      panelHeight.value = e.nativeEvent.layout.height;
    };

    const toggleDetails = () => {
      if (expanded) {
        setExpanded(false);
        open.value = withTiming(0, SETTLE);
        return;
      }
      // Opening from a shrunk header goes back to the top first.
      if (scrollY.value > 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
      setExpanded(true);
      open.value = withTiming(1, SETTLE);
    };

    // G1: a vertical drag on the header moves the panel with the finger, at the top of the page.
    // Horizontal swipes stay with the tab pager.
    const dragStart = useSharedValue(0);
    const dragging = useSharedValue(false);
    const drag = usePanGesture({
      activeOffsetY: [-10, 10],
      failOffsetX: [-15, 15],
      onActivate: () => {
        'worklet';
        dragging.value = scrollY.value <= 0;
        dragStart.value = open.value;
      },
      onUpdate: (e) => {
        'worklet';
        if (!dragging.value) return;
        open.value = dragOpenness(dragStart.value, e.translationY, panelHeight.value);
      },
      onDeactivate: (e) => {
        'worklet';
        if (!dragging.value) return;
        dragging.value = false;
        const target = settleOpenness(open.value, e.velocityY);
        open.value = withTiming(target, SETTLE);
        runOnJS(setExpanded)(target === 1);
      },
    });

    const newMovementRoute = deps.newMovementRoute;
    const sync = deps.refresh;
    const onRefresh = sync
      ? async () => {
          setRefreshing(true);
          try {
            await sync().catch(() => undefined);
            await accounts.refetch();
          } finally {
            setRefreshing(false);
          }
        }
      : undefined;

    return (
      <View style={styles.root} testID="accounts.dashboard">
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          testID="accounts.dashboard.scroll"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.background}
                progressViewOffset={insets.top + HEADER_CHROME + CARD_OPEN}
              />
            ) : undefined
          }
        >
          <Animated.View style={spacerStyle} testID="accounts.dashboard.spacer" />
          {accounts.isError ? (
            <ErrorState message={t.loadError} onRetry={() => void accounts.refetch()} />
          ) : null}
          {deps.renderGoals?.()}
          {deps.renderMovements?.()}
        </Animated.ScrollView>
        <GestureDetector gesture={drag}>
          <View style={styles.header} pointerEvents="box-none" testID="accounts.dashboard.header">
            <View onLayout={onHeaderLayout}>
              <HeaderBlue
                dashboard
                name={name}
                hasUnread={unread > 0}
                onPressAccount={() => navigation.navigate(deps.accountRoute)}
                onPressStatistics={() => navigation.navigate(deps.statisticsRoute)}
                onPressNotifications={() => navigation.navigate(deps.notificationsRoute)}
              >
                <View>
                  <DashboardBalanceCard
                    totalMinor={overview?.balanceTotalMinor ?? null}
                    connectedCount={overview?.connectedCount ?? 0}
                    summary={summary}
                    collapse={state}
                  />
                  {/* Always there, so a drag can open it; closed, nobody can read or touch it. */}
                  <Animated.View
                    style={[styles.panel, panelStyle]}
                    pointerEvents={expanded ? 'auto' : 'none'}
                    accessibilityElementsHidden={!expanded}
                    importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
                    testID="accounts.dashboard.panelFrame"
                  >
                    <View onLayout={onPanelLayout}>
                      <AccountsPanel
                        rows={accountRows(overview?.accounts ?? [])}
                        onPressRow={(accountId) =>
                          navigation.navigate(ACCOUNT_DETAIL_ROUTE, { accountId })
                        }
                        onConnect={onConnect}
                      />
                    </View>
                  </Animated.View>
                </View>
              </HeaderBlue>
            </View>
            <DetailsTab expanded={expanded} onToggle={toggleDetails} openness={open} />
          </View>
        </GestureDetector>
        {newMovementRoute && menuOpen ? (
          <FabMenu
            onClose={closeMenu}
            onPick={(kind) => {
              setMenuOpen(false);
              navigation.navigate(newMovementRoute(), { kind });
            }}
          />
        ) : null}
        {newMovementRoute ? (
          <Fab
            accessibilityLabel={t.newMovement}
            expanded={menuOpen}
            onPress={() => setMenuOpen((isOpen) => !isOpen)}
            style={styles.fab}
            testID="accounts.dashboard.fab"
          />
        ) : null}
      </View>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    // Like Screen with a tab bar: 20 px sides, 22 px between blocks, room for the tab bar below.
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.screen,
      paddingBottom: spacing.tabBarClearance,
      gap: spacing.block,
    },
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
    panel: { overflow: 'hidden' },
    // Right 16 like the design (`.fab`). The design's bottom 92 counts its 72 px tab bar, which
    // overlaps the page there; here the bar sits below the page, so 12 px keeps the FAB just above
    // it (QA review 2026-11-07, V1).
    fab: { position: 'absolute', right: 16, bottom: FAB_BOTTOM },
  });
