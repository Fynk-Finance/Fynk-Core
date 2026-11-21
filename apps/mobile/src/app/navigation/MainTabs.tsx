// The four main tabs. They switch by tapping the tab bar or by swiping the page sideways
// (decided 27 Oct 2026). A horizontal carousel inside a tab scrolls first and hands the swipe to
// the tabs at its edge (react-native-pager-view). With Reduce Motion on, a tap jumps instead of
// sliding; a swipe still follows the finger. The blue header of the tabs that use the shared
// header stays in place above the pager and changes height between tabs (QA review 2026-11-07,
// G2, TabHeaderHost).
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useIsFocused } from '@react-navigation/native';
import { NavigationBar } from 'expo-navigation-bar';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { createPlaceholderScreen, TabHeaderProvider, type TabName } from '@shared/navigation';
import { useTheme } from '@shared/ui';

import { navigationBarStyle } from '../navigationBar';
import { moduleRoutes, tabOrder, tabOwners } from '../registry';
import { TAB_LABELS, TabBar } from './TabBar';
import { TabHeaderHost } from './TabHeaderHost';

const Tab = createMaterialTopTabNavigator();

function tabComponent(tab: (typeof tabOrder)[number]) {
  const owner = tabOwners[tab];
  return (
    moduleRoutes[owner].tab ??
    createPlaceholderScreen({ title: TAB_LABELS[tab], owner, withHeader: true })
  );
}

const TAB_SCREENS = tabOrder.map((tab) => ({ tab, component: tabComponent(tab) }));

/** The tabs whose screen draws its header with useTabHeader. The others keep their own. */
const SHARED_HEADER_TABS: readonly TabName[] = ['Billetera', 'Recomendaciones', 'Inversion'];

export function MainTabs() {
  const reduceMotion = useReducedMotion();
  const { scheme } = useTheme();
  // A pushed screen covers the tab bar without unmounting the tabs, so the override follows focus.
  const focused = useIsFocused();
  return (
    <TabHeaderProvider tabs={tabOrder} shared={SHARED_HEADER_TABS}>
      {focused ? <NavigationBar style={navigationBarStyle(scheme, true)} /> : null}
      <View style={styles.fill}>
        <Tab.Navigator
          tabBarPosition="bottom"
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{ swipeEnabled: true, animationEnabled: !reduceMotion, lazy: true }}
        >
          {TAB_SCREENS.map(({ tab, component }) => (
            <Tab.Screen
              key={tab}
              name={tab}
              component={component}
              options={{ title: TAB_LABELS[tab] }}
            />
          ))}
        </Tab.Navigator>
        <TabHeaderHost />
      </View>
    </TabHeaderProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
