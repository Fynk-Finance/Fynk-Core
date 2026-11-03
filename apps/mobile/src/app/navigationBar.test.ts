import { navigationBarStyle } from './navigationBar';

describe('navigationBarStyle', () => {
  it('uses dark buttons over the tab bar in both themes', () => {
    expect(navigationBarStyle('light', true)).toBe('dark');
    expect(navigationBarStyle('dark', true)).toBe('dark');
  });

  it('uses buttons that contrast with the canvas on the other screens', () => {
    expect(navigationBarStyle('light', false)).toBe('dark');
    expect(navigationBarStyle('dark', false)).toBe('light');
  });
});
