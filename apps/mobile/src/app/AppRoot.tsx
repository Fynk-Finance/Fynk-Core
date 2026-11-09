import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogHost, ThemeProvider, useAppFonts, useTheme, type Theme } from '@shared/ui';

import { buildLinking } from './linking';
import { navigationBarStyle } from './navigationBar';
import { RootNavigator } from './navigation/RootNavigator';
import { createQueryClient } from './queryClient';
import { bindQueryClient, startModules } from './startup';

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

// M10 and M11 take their dependencies here, before the vault can open.
startModules();

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
      {/* Android buttons follow the theme; MainTabs overrides them while the tab bar shows. */}
      <NavigationBar style={navigationBarStyle(theme.scheme, false)} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export function AppRoot() {
  const fontsReady = useAppFonts();
  const [queryClient] = useState(createQueryClient);
  // Sync, movement changes and unlock refresh M10's cached numbers in this client.
  useEffect(() => bindQueryClient(queryClient), [queryClient]);

  // The native splash screen stays until the design fonts are ready.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ThemedNavigation />
            {/* The Fynk dialogs of dialog.show(), above every screen (QA review 2026-11-07, V8). */}
            <DialogHost />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
