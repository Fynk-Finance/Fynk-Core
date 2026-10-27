import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useAppFonts, useTheme, type Theme } from '@shared/ui';

import { buildLinking } from './linking';
import { RootNavigator } from './navigation/RootNavigator';
import { createQueryClient } from './queryClient';

/** React Navigation's theme from the active palette (screen backgrounds, cards, text). */
export function navigationTheme({ scheme, colors }: Theme): NavigationTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: scheme === 'dark',
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.textPrimary,
      border: colors.border,
    },
  };
}

const linking = buildLinking();
if (__DEV__ && linking.config) {
  // fynk://dev/catalogo opens the design system catalog in development builds.
  linking.config.screens = { ...linking.config.screens, DevCatalog: 'dev/catalogo' };
}

function ThemedNavigation() {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  // The window behind the screens (overscroll, keyboard edges) uses the canvas color.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.canvas);
  }, [theme]);

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      {/* Every screen starts under a blue header, so the status bar text is light in both themes. */}
      <StatusBar style="light" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export function AppRoot() {
  const fontsReady = useAppFonts();
  const [queryClient] = useState(createQueryClient);

  // The native splash screen stays until the design fonts are ready.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ThemedNavigation />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
