import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, useAppFonts } from '@shared/ui';

import { buildLinking } from './linking';
import { RootNavigator } from './navigation/RootNavigator';
import { createQueryClient } from './queryClient';

const theme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
  },
};

const linking = buildLinking();
if (__DEV__ && linking.config) {
  // fynk://dev/catalogo opens the design system catalog in development builds.
  linking.config.screens = { ...linking.config.screens, DevCatalog: 'dev/catalogo' };
}

export function AppRoot() {
  const fontsReady = useAppFonts();
  const [queryClient] = useState(createQueryClient);

  // The native splash screen stays until the design fonts are ready.
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={theme} linking={linking}>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
