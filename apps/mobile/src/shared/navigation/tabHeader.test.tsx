// useTabHeader outside the shared header (QA review 2026-11-07, G2): screen tests and the
// catalog render a tab without the tab navigator, and a tab not moved to the shared header yet
// keeps its own. Both get a plain HeaderBlue in the page.
import { NavigationRouteContext } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';
import type { ContextType } from 'react';
import { Text } from 'react-native';

import { createTabHeaderStore, TabHeaderProvider, useTabHeader } from './tabHeader';
import type { TabName } from './types';

const route = (name: TabName) =>
  ({ key: `${name}-key`, name }) as ContextType<typeof NavigationRouteContext>;

function Page({ title }: { title: string }) {
  const header = useTabHeader({ name: 'Laura Gómez', title });
  return (
    <>
      {header}
      <Text>page body</Text>
    </>
  );
}

describe('useTabHeader without the shared header', () => {
  it('draws a plain HeaderBlue outside the tabs', async () => {
    await render(<Page title="Billetera" />);
    expect(screen.getByText('Billetera')).toBeTruthy();
    expect(screen.getByTestId('header-bell')).toBeTruthy();
    expect(screen.queryByTestId('tab-header-spacer', { includeHiddenElements: true })).toBeNull();
  });

  it('draws a plain HeaderBlue for a tab that does not use the shared header', async () => {
    await render(
      <TabHeaderProvider tabs={['Dashboard', 'Billetera']} shared={['Billetera']}>
        <NavigationRouteContext.Provider value={route('Dashboard')}>
          <Page title="Dashboard" />
        </NavigationRouteContext.Provider>
      </TabHeaderProvider>,
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.queryByTestId('tab-header-spacer', { includeHiddenElements: true })).toBeNull();
  });
});

describe('createTabHeaderStore', () => {
  const entry = { chrome: { name: 'Laura', dashboard: false }, content: null };

  it('notifies on every change and keeps the last snapshot', () => {
    const store = createTabHeaderStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    store.set('Billetera', entry);
    store.setFocused(1);
    store.setFocused(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().entries.get('Billetera')).toBe(entry);
    expect(store.getSnapshot().focused).toBe(1);

    store.remove('Billetera');
    store.remove('Billetera');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot().entries.size).toBe(0);
    unsubscribe();
    store.setFocused(2);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
