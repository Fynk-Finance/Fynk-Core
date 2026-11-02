// Color of the Android navigation bar buttons. The app draws edge to edge, so the screen shows
// through the bar and the buttons must contrast with whatever is under them. The contrast layer
// Android paints over three-button bars is off (expo-navigation-bar plugin in app.json).
import type { Theme } from '@shared/ui';

/**
 * Color of the buttons, as expo-navigation-bar reads it: `dark` gives dark buttons, like
 * expo-status-bar. Its 58.0.4 type comments say the opposite, but its native module treats
 * `dark` as dark content (checked on a phone).
 */
export type NavigationBarStyle = 'light' | 'dark';

/**
 * Over the tab bar the buttons are dark in both themes, because the tab bar is the same light
 * blue (`primaryLight`) in light and dark. Elsewhere they contrast with the theme's canvas.
 */
export function navigationBarStyle(
  scheme: Theme['scheme'],
  overTabBar: boolean,
): NavigationBarStyle {
  if (overTabBar) return 'dark';
  return scheme === 'dark' ? 'light' : 'dark';
}
