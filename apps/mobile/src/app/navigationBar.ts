// Color of the Android navigation bar buttons. The app draws edge to edge, so the screen shows
// through the bar and the buttons must contrast with whatever is under them. The contrast layer
// Android paints over three-button bars is off (expo-navigation-bar plugin in app.json).
import type { Theme } from '@shared/ui';

/** expo-navigation-bar styles: `light` is a light bar with dark buttons, `dark` the opposite. */
export type NavigationBarStyle = 'light' | 'dark';

/**
 * Over the tab bar the buttons are dark in both themes, because the tab bar is the same light
 * blue (`primaryLight`) in light and dark. Elsewhere they follow the theme's canvas.
 */
export function navigationBarStyle(
  scheme: Theme['scheme'],
  overTabBar: boolean,
): NavigationBarStyle {
  if (overTabBar) return 'light';
  return scheme === 'dark' ? 'dark' : 'light';
}
