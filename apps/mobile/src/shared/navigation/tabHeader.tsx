// The tabs' shared blue header (QA review 2026-11-07, G2, SCRUM-89). The tab pages slide inside a
// native pager that clips each page, so a header inside a page always slides with it. Instead,
// the tab navigator draws one header above the pager (app/navigation/TabHeaderHost) and each tab
// registers its own header content there with `useTabHeader`. The page keeps a spacer as tall as
// its header, so its layout does not change.
//
// Content registered here is drawn by the host, outside the screen's navigation context: it must
// get what it needs through props and callbacks, never with useNavigation or useRoute.
import { NavigationRouteContext } from '@react-navigation/native';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Animated as RNAnimated } from 'react-native';
import Animated, { makeMutable, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HeaderBlue,
  HeaderBlueContent,
  headerBlueHeight,
  type HeaderBlueProps,
  type HeaderGreetingRowProps,
} from '../ui';
import { UNKNOWN } from './tabHeaderBlend';
import type { TabName } from './types';

export interface TabHeaderOptions extends HeaderBlueProps {
  /** Drawn just below the blue card, outside it (the Dashboard's Detalle de cuentas tab). */
  below?: ReactNode;
  /** The content's live height, when the tab animates it itself (the Dashboard). Measured if unset. */
  contentHeight?: SharedValue<number>;
  /** Moves the whole header down while this tab is shown (the Dashboard's pull to sync). */
  offsetY?: SharedValue<number>;
}

export interface TabHeaderEntry {
  chrome: Omit<HeaderGreetingRowProps, 'avatar'> & { dashboard: boolean };
  /** The title row and the extra content, or null when the tab has only the greeting. */
  content: ReactNode;
  below?: ReactNode;
  contentHeight?: SharedValue<number>;
  offsetY?: SharedValue<number>;
}

export interface TabHeaderSnapshot {
  entries: ReadonlyMap<TabName, TabHeaderEntry>;
  /** The focused tab's index, from the tab bar. */
  focused: number;
}

/** What the host reads. A change re-renders the host only, never the tab screens. */
export interface TabHeaderStore {
  getSnapshot(): TabHeaderSnapshot;
  subscribe(listener: () => void): () => void;
  set(tab: TabName, entry: TabHeaderEntry): void;
  remove(tab: TabName): void;
  setFocused(index: number): void;
}

export function createTabHeaderStore(): TabHeaderStore {
  let snapshot: TabHeaderSnapshot = { entries: new Map(), focused: 0 };
  const listeners = new Set<() => void>();
  const update = (next: TabHeaderSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(tab, entry) {
      update({ ...snapshot, entries: new Map(snapshot.entries).set(tab, entry) });
    },
    remove(tab) {
      if (!snapshot.entries.has(tab)) return;
      const entries = new Map(snapshot.entries);
      entries.delete(tab);
      update({ ...snapshot, entries });
    },
    setFocused(index) {
      if (index !== snapshot.focused) update({ ...snapshot, focused: index });
    },
  };
}

export interface TabHeaderBridge {
  /** Every tab, in the tab bar's order. */
  tabs: readonly TabName[];
  /** The tabs drawn by the shared header. The others keep their own header in the page. */
  shared: ReadonlySet<TabName>;
  store: TabHeaderStore;
  /** The pager's position, copied from the tab bar. */
  position: SharedValue<number>;
  /** Measured content height of each tab, UNKNOWN until its header is drawn. */
  heights: ReadonlyMap<TabName, SharedValue<number>>;
  /** Switches to the tab at an index, as a press on the tab bar does. */
  jumpTo(index: number): void;
  /** Set by the tab bar. */
  setPosition(value: number): void;
  setJumpTo(jump: (index: number) => void): void;
}

const TabHeaderContext = createContext<TabHeaderBridge | null>(null);

export function TabHeaderProvider({
  tabs,
  shared,
  children,
}: {
  tabs: readonly TabName[];
  shared: readonly TabName[];
  children: ReactNode;
}) {
  const [bridge] = useState<TabHeaderBridge>(() => {
    const position = makeMutable(0);
    let jump: (index: number) => void = () => undefined;
    return {
      tabs,
      shared: new Set(shared),
      store: createTabHeaderStore(),
      position,
      heights: new Map(tabs.map((tab) => [tab, makeMutable(UNKNOWN)])),
      jumpTo: (index) => jump(index),
      setPosition: (value) => {
        position.value = value;
      },
      setJumpTo: (next) => {
        jump = next;
      },
    };
  });
  return <TabHeaderContext.Provider value={bridge}>{children}</TabHeaderContext.Provider>;
}

/** The shared header's state, or null outside the tabs. */
export function useTabHeaderBridge(): TabHeaderBridge | null {
  return useContext(TabHeaderContext);
}

/**
 * Called by the tab bar: copies the pager's position (an Animated value driven on the native side)
 * into the header's shared value, and tells the header which tab is focused and how to switch.
 */
export function useSyncTabHeader(
  position: RNAnimated.AnimatedInterpolation<number>,
  index: number,
  jumpTo: (index: number) => void,
) {
  const bridge = useTabHeaderBridge();
  const first = useRef(index);
  useEffect(() => {
    if (!bridge) return undefined;
    bridge.setPosition(first.current);
    const id = position.addListener(({ value }) => bridge.setPosition(value));
    return () => position.removeListener(id);
  }, [bridge, position]);
  useEffect(() => {
    bridge?.store.setFocused(index);
  }, [bridge, index]);
  useEffect(() => {
    bridge?.setJumpTo(jumpTo);
  });
}

/**
 * The blue header of a tab. Inside the tabs it hands the header to the shared header and returns
 * a spacer as tall as it; anywhere else (a test, the catalog) it returns a plain HeaderBlue.
 */
export function useTabHeader(options: TabHeaderOptions): ReactNode {
  const { below, contentHeight, offsetY, ...props } = options;
  const bridge = useTabHeaderBridge();
  const route = useContext(NavigationRouteContext);
  const tab = route?.name as TabName | undefined;
  const active = !!bridge && !!tab && bridge.shared.has(tab);
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    if (!active || !bridge || !tab) return;
    const { title, subtitle, trailing, children } = props;
    const hasContent = !!title || (children != null && children !== false);
    bridge.store.set(tab, {
      chrome: {
        name: props.name,
        hasUnread: props.hasUnread,
        onPressAccount: props.onPressAccount,
        onPressNotifications: props.onPressNotifications,
        onPressStatistics: props.onPressStatistics,
        avatarTone: props.avatarTone,
        dashboard: !!props.dashboard,
      },
      content: hasContent ? (
        <HeaderBlueContent title={title} subtitle={subtitle} trailing={trailing}>
          {children}
        </HeaderBlueContent>
      ) : null,
      below,
      contentHeight,
      offsetY,
    });
  });
  useLayoutEffect(() => {
    if (!active || !bridge || !tab) return undefined;
    return () => bridge.store.remove(tab);
  }, [active, bridge, tab]);

  const height = contentHeight ?? (active && tab ? bridge?.heights.get(tab) : undefined);
  const spacerStyle = useAnimatedStyle(() => ({
    height: headerBlueHeight(insets.top, height ? Math.max(0, height.value) : 0),
  }));

  if (!active) return <HeaderBlue {...props} />;
  return (
    <Animated.View
      style={spacerStyle}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="tab-header-spacer"
    />
  );
}
