import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { createPlaceholderScreen } from '@shared/navigation';

import { moduleRoutes, tabOrder, tabOwners } from '../registry';
import { TAB_LABELS, TabBar } from './TabBar';

const Tab = createBottomTabNavigator();

function tabComponent(tab: (typeof tabOrder)[number]) {
  const owner = tabOwners[tab];
  return (
    moduleRoutes[owner].tab ??
    createPlaceholderScreen({ title: TAB_LABELS[tab], owner, withHeader: true })
  );
}

const TAB_SCREENS = tabOrder.map((tab) => ({ tab, component: tabComponent(tab) }));

export function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
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
