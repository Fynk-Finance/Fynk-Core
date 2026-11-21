// The tabs' shared blue header (QA review 2026-11-07, G2, SCRUM-89). The pager's position and the
// gestures do not run in Jest; the blend math is covered in tabHeaderBlend.test.ts. Here: what the
// host draws for the tabs at rest, and what stays in the pages.
import { NavigationRouteContext } from '@react-navigation/native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ContextType, type ReactNode } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  TabHeaderProvider,
  useTabHeader,
  useTabHeaderBridge,
  type TabHeaderBridge,
  type TabName,
} from '@shared/navigation';
import { headerBlueHeight, uiStrings } from '@shared/ui';

import { TabHeaderHost } from './TabHeaderHost';

const TABS: TabName[] = ['Dashboard', 'Billetera', 'Recomendaciones', 'Inversion'];

const route = (name: TabName) =>
  ({ key: `${name}-key`, name }) as ContextType<typeof NavigationRouteContext>;

const rendered = jest.fn<void, [TabName]>();
const renderCount = (tab: TabName) => rendered.mock.calls.filter(([t]) => t === tab).length;

function Page({
  tab,
  title,
  onBell,
  light,
}: {
  tab: TabName;
  title?: string;
  onBell?: () => void;
  light?: boolean;
}) {
  rendered(tab);
  const header = useTabHeader({
    name: 'Laura Gómez',
    title,
    onPressNotifications: onBell,
    avatarTone: light ? 'light' : 'primary',
  });
  return (
    <>
      {header}
      <Text>{`body of ${tab}`}</Text>
    </>
  );
}

function InTab(props: Parameters<typeof Page>[0]) {
  return (
    <NavigationRouteContext.Provider value={route(props.tab)}>
      <Page {...props} />
    </NavigationRouteContext.Provider>
  );
}

const probe: { bridge: TabHeaderBridge | null } = { bridge: null };
function Probe({ focused }: { focused: number }) {
  const bridge = useTabHeaderBridge();
  useEffect(() => {
    probe.bridge = bridge;
    bridge?.store.setFocused(focused);
    bridge?.setPosition(focused);
  }, [bridge, focused]);
  return null;
}

async function renderTabs(
  pages: ReactNode,
  { focused = 1, shared = ['Billetera', 'Recomendaciones', 'Inversion'] as TabName[] } = {},
) {
  return render(
    <GestureHandlerRootView>
      <TabHeaderProvider tabs={TABS} shared={shared}>
        <Probe focused={focused} />
        {pages}
        <TabHeaderHost />
      </TabHeaderProvider>
    </GestureHandlerRootView>,
  );
}

describe('TabHeaderHost', () => {
  it('draws the header once, above the pages, and leaves a spacer in each page', async () => {
    await renderTabs(
      <>
        <InTab tab="Billetera" title="Billetera" />
        <InTab tab="Recomendaciones" title="Recomendaciones" />
      </>,
    );
    expect(screen.getAllByTestId('header-bell')).toHaveLength(1);
    expect(
      screen.getAllByTestId('tab-header-spacer', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.getByText('Billetera')).toBeTruthy();
    expect(screen.getByText('body of Billetera')).toBeTruthy();
    // Not measured yet: the spacer is as tall as a header with only the greeting.
    expect(
      screen.getAllByTestId('tab-header-spacer', { includeHiddenElements: true })[0],
    ).toHaveStyle({
      height: headerBlueHeight(0, 0),
    });
  });

  it('shows and lets you touch only the focused tab content (criterion 2)', async () => {
    await renderTabs(
      <>
        <InTab tab="Billetera" title="Billetera" />
        <InTab tab="Recomendaciones" title="Recomendaciones" />
      </>,
    );
    const focused = screen.getByTestId('tab-header.content.1');
    const other = screen.getByTestId('tab-header.content.2', { includeHiddenElements: true });
    expect(focused).toHaveStyle({ opacity: 1 });
    expect(focused.props.pointerEvents).toBe('box-none');
    expect(other).toHaveStyle({ opacity: 0 });
    expect(other.props.pointerEvents).toBe('none');
  });

  it('presses go to the focused tab handlers', async () => {
    const billetera = jest.fn();
    const recomendaciones = jest.fn();
    const { rerender } = await renderTabs(
      <>
        <InTab tab="Billetera" onBell={billetera} />
        <InTab tab="Recomendaciones" onBell={recomendaciones} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: uiStrings.notifications }));
    expect(billetera).toHaveBeenCalledTimes(1);

    await rerender(
      <GestureHandlerRootView>
        <TabHeaderProvider tabs={TABS} shared={['Billetera', 'Recomendaciones']}>
          <Probe focused={2} />
          <InTab tab="Billetera" onBell={billetera} />
          <InTab tab="Recomendaciones" onBell={recomendaciones} />
          <TabHeaderHost />
        </TabHeaderProvider>
      </GestureHandlerRootView>,
    );
    await fireEvent.press(screen.getByRole('button', { name: uiStrings.notifications }));
    expect(recomendaciones).toHaveBeenCalledTimes(1);
  });

  it('stores the measured content height for the card and the page spacer', async () => {
    await renderTabs(<InTab tab="Billetera" title="Billetera" />);
    await act(async () => {
      fireEvent(screen.getByTestId('tab-header.content.1'), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 64 } },
      });
    });
    expect(probe.bridge?.heights.get('Billetera')?.value).toBe(64);
  });

  it('removes a tab content when its screen unmounts', async () => {
    const { rerender } = await renderTabs(<InTab tab="Billetera" title="Billetera" />);
    expect(screen.getByText('Billetera')).toBeTruthy();
    await rerender(
      <GestureHandlerRootView>
        <TabHeaderProvider tabs={TABS} shared={['Billetera']}>
          <Probe focused={1} />
          <TabHeaderHost />
        </TabHeaderProvider>
      </GestureHandlerRootView>,
    );
    expect(screen.queryByText('Billetera')).toBeNull();
  });

  it('re-renders only the host when a tab updates its header', async () => {
    const { rerender } = await renderTabs(
      <>
        <InTab tab="Billetera" title="Billetera" />
        <InTab tab="Inversion" />
      </>,
    );
    const before = renderCount('Inversion');
    await rerender(
      <GestureHandlerRootView>
        <TabHeaderProvider tabs={TABS} shared={['Billetera', 'Inversion']}>
          <Probe focused={1} />
          <InTab tab="Billetera" title="Billetera · nuevo" />
          <InTab tab="Inversion" />
          <TabHeaderHost />
        </TabHeaderProvider>
      </GestureHandlerRootView>,
    );
    expect(screen.getByText('Billetera · nuevo')).toBeTruthy();
    // Inversión rendered once more only because the test re-rendered it, not from the store.
    expect(renderCount('Inversion')).toBe(before + 1);
  });

  it('lets touches through while the focused tab keeps its own header', async () => {
    await renderTabs(<InTab tab="Billetera" title="Billetera" />, { focused: 0 });
    expect(screen.getByTestId('tab-header').props.pointerEvents).toBe('none');
  });

  // Android draws an elevation shadow with the view's own opacity, so the fade must be on the card
  // that casts it, or the shadow stays on the Dashboard after the card is gone.
  it('fades the card itself, shadow included, toward a tab with its own header', async () => {
    await renderTabs(<InTab tab="Billetera" title="Billetera" />, { focused: 0 });
    expect(screen.getByTestId('tab-header.card')).toHaveStyle({ opacity: 0 });
    expect(screen.getByTestId('tab-header')).not.toHaveStyle({ opacity: 0 });
  });

  it('shows the card on a tab that uses the shared header', async () => {
    // Jest computes animated styles at mount only: mount the host again once the position is on
    // Billetera.
    const tree = (hostKey: string) => (
      <GestureHandlerRootView>
        <TabHeaderProvider tabs={TABS} shared={['Billetera']}>
          <Probe focused={1} />
          <InTab tab="Billetera" title="Billetera" />
          <TabHeaderHost key={hostKey} />
        </TabHeaderProvider>
      </GestureHandlerRootView>
    );
    const { rerender } = await render(tree('first'));
    await rerender(tree('again'));
    expect(screen.getByTestId('tab-header.card')).toHaveStyle({ opacity: 1 });
  });

  it('draws nothing when no tab uses the shared header', async () => {
    await renderTabs(<InTab tab="Billetera" title="Billetera" />, { shared: [] });
    expect(screen.queryByTestId('tab-header')).toBeNull();
    expect(screen.getByTestId('header-bell')).toBeTruthy();
  });
});
