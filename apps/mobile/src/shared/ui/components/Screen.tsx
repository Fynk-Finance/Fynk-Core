import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useThemedStyles, type Theme } from '../theme';
import { spacing } from '../tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Rendered above the content, outside the scroll, e.g. <HeaderBlue />. It handles the top inset. */
  header?: ReactNode;
  scroll?: boolean;
  /** 20 px side padding of the design. */
  padded?: boolean;
  /** Leaves room for the bottom tab bar (104 px in the design). */
  withTabBar?: boolean;
  gap?: number;
  /**
   * Pull to refresh of a scroll screen (HU-011), e.g. M5's syncNow(). The spinner stays until
   * the promise settles; a failure is left to the caller, the screen only stops spinning.
   */
  refresh?: () => Promise<unknown>;
  /** The root view; the scroll view gets `<testID>.scroll`. */
  testID?: string;
}

export function Screen({
  children,
  header,
  scroll = false,
  padded = true,
  withTabBar = false,
  gap = spacing.section,
  refresh,
  testID,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    if (!refresh) return;
    setRefreshing(true);
    try {
      await refresh().catch(() => undefined);
    } finally {
      setRefreshing(false);
    }
  };
  const insets = useSafeAreaInsets();
  const content = [
    padded ? styles.padded : null,
    {
      gap,
      paddingTop: header ? spacing.block : insets.top + spacing.screen,
      paddingBottom: withTabBar ? spacing.tabBarClearance : insets.bottom + spacing.screen,
    },
  ];

  return (
    <View style={styles.root} testID={testID}>
      {header}
      {scroll ? (
        <ScrollView
          testID={testID ? `${testID}.scroll` : undefined}
          contentContainerStyle={content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.background}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    padded: { paddingHorizontal: spacing.screen },
  });
