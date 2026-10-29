import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemedStyles, type Theme } from '../theme';
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
  testID?: string;
}

export function Screen({
  children,
  header,
  scroll = false,
  padded = true,
  withTabBar = false,
  gap = spacing.section,
  testID,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);
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
          contentContainerStyle={content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
