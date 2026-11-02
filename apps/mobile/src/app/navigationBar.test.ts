import { navigationBarStyle } from './navigationBar';

describe('navigationBarStyle', () => {
  it('uses dark buttons over the tab bar in both themes', () => {
    expect(navigationBarStyle('light', true)).toBe('light');
    expect(navigationBarStyle('dark', true)).toBe('light');
  });

  it('follows the theme on the other screens', () => {
    expect(navigationBarStyle('light', false)).toBe('light');
    expect(navigationBarStyle('dark', false)).toBe('dark');
  });
});
