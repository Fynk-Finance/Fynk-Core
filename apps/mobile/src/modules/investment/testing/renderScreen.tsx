// Renders module screens inside the providers of the app (theme, query client, a stack
// navigator). Test-only: never import this file from app code.
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import { ThemeProvider, type ThemePreference } from '@shared/ui';

const Stack = createNativeStackNavigator();
const noStore = { load: async () => 'system' as const, save: async () => undefined };

/** A stand-in for another module's screen: prints its route name and params. */
export function RouteProbe() {
  const route = useRoute();
  return <Text testID="probe.route">{`${route.name} ${JSON.stringify(route.params ?? {})}`}</Text>;
}

export interface RenderOptions {
  screens: Record<string, ComponentType>;
  initial: string;
  initialParams?: object;
  preference?: ThemePreference;
}

export async function renderScreens({
  screens,
  initial,
  initialParams,
  preference,
}: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  await render(
    <ThemeProvider initialPreference={preference ?? 'light'} store={noStore}>
      <QueryClientProvider client={client}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
            {Object.entries(screens).map(([name, component]) => (
              <Stack.Screen
                key={name}
                name={name}
                component={component}
                initialParams={name === initial ? initialParams : undefined}
              />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { client };
}
