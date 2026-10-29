// The four main tabs. They switch by tapping the tab bar or by swiping the page sideways
// (decided 27 Oct 2026). A horizontal carousel inside a tab scrolls first and hands the swipe to
// the tabs at its edge (react-native-pager-view). With Reduce Motion on, a tap jumps instead of
// sliding; a swipe still follows the finger.
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useReducedMotion } from 'react-native-reanimated';

import { createPlaceholderScreen } from '@shared/navigation';

import { moduleRoutes, tabOrder, tabOwners } from '../registry';
import { TAB_LABELS, TabBar } from './TabBar';

const Tab = createMaterialTopTabNavigator();

function tabComponent(tab: (typeof tabOrder)[number]) {
  const owner = tabOwners[tab];
  return (
    moduleRoutes[owner].tab ??
    createPlaceholderScreen({ title: TAB_LABELS[tab], owner, withHeader: true })
  );
}

const TAB_SCREENS = tabOrder.map((tab) => ({ tab, component: tabComponent(tab) }));

export function MainTabs() {
  const reduceMotion = useReducedMotion();
  return (
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
  );
}
