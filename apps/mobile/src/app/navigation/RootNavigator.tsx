// Root of the app: the first full-screen flow whose gate is open (sign in, unlock, onboarding),
// otherwise the main tabs plus every module's pushed screens. Every screen gets the default
// transition and back gesture of its kind (screenOptionsFor in @shared/navigation) unless its
// ModuleScreen says otherwise.
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useReducedMotion } from 'react-native-reanimated';

import type { ModuleName } from '@shared/domain/types';
import { APPEARANCE_ROUTE, flowOptions, screenOptionsFor } from '@shared/navigation';
import { CatalogScreen } from '@shared/ui/__catalog__/CatalogScreen';

import { collectScreens, gateOrder, moduleRoutes } from '../registry';
import { AppearanceScreen } from '../settings/AppearanceScreen';
import { MainTabs } from './MainTabs';

const Stack = createNativeStackNavigator();
const SCREENS = collectScreens();
const closed = () => false;

/** Gates run in the fixed gateOrder on every render, so the hook order never changes. */
function useOpenGate(): ModuleName | null {
  let open: ModuleName | null = null;
  for (const module of gateOrder) {
    const gate = moduleRoutes[module].useGate ?? closed;
    const isOpen = gate();
    if (open === null && isOpen && moduleRoutes[module].flow) open = module;
  }
  return open;
}

export function RootNavigator() {
  const gate = useOpenGate();
  const reduceMotion = useReducedMotion();
  const Flow = gate ? moduleRoutes[gate].flow : undefined;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...screenOptionsFor({}, { reduceMotion }) }}
    >
      {gate && Flow ? (
        <Stack.Screen name={`${gate}.Flow`} component={Flow} options={flowOptions} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={flowOptions} />
          {SCREENS.map((s) => (
            <Stack.Screen
              key={s.name}
              name={s.name}
              component={s.component}
              options={screenOptionsFor(s, { reduceMotion })}
            />
          ))}
          <Stack.Screen name={APPEARANCE_ROUTE} component={AppearanceScreen} />
          {__DEV__ ? <Stack.Screen name="DevCatalog" component={CatalogScreen} /> : null}
        </>
      )}
    </Stack.Navigator>
  );
}
