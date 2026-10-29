// Light and dark theme of the app (shared contracts 3.6, owned by M0).
// Default: follow the phone. A saved choice (Claro or Oscuro) overrides it and applies at once.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { palettes, shadows, type ColorScheme, type Palette, type Shadows } from '../tokens';
import { asyncStorageThemeStore, type ThemePreferenceStore } from './preferenceStore';
import { DEFAULT_THEME_PREFERENCE, resolveScheme, type ThemePreference } from './scheme';

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  shadow: Shadows;
}

/** One frozen object per scheme, so styles built from a theme can be cached by identity. */
export const themes: Record<ColorScheme, Theme> = {
  light: { scheme: 'light', colors: palettes.light, shadow: shadows.light },
  dark: { scheme: 'dark', colors: palettes.dark, shadow: shadows.dark },
};

interface ThemeState {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

// Without a provider (component tests, the catalog) everything draws in light.
const ThemeContext = createContext<ThemeState>({
  theme: themes.light,
  preference: DEFAULT_THEME_PREFERENCE,
  setPreference: () => undefined,
});

export interface ThemeProviderProps {
  children: ReactNode;
  /** Tests and the catalog pass a store; the app uses AsyncStorage. */
  store?: ThemePreferenceStore;
  /** Starts with this choice instead of loading it (tests, catalog). */
  initialPreference?: ThemePreference;
}

export function ThemeProvider({
  children,
  store = asyncStorageThemeStore,
  initialPreference,
}: ThemeProviderProps) {
  const phoneScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    initialPreference ?? DEFAULT_THEME_PREFERENCE,
  );

  useEffect(() => {
    if (initialPreference) return;
    let active = true;
    void store.load().then((saved) => {
      if (active) setPreferenceState(saved);
    });
    return () => {
      active = false;
    };
  }, [store, initialPreference]);

  // Native parts (keyboard, alerts, date pickers) follow the same choice.
  useEffect(() => {
    Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      void store.save(next);
    },
    [store],
  );

  const scheme = resolveScheme(preference, phoneScheme);
  const value = useMemo(
    () => ({ theme: themes[scheme], preference, setPreference }),
    [scheme, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette and shadows. Every color on screen comes from here. */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** The saved choice and its setter, for the Apariencia screen. */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const { preference, setPreference } = useContext(ThemeContext);
  return [preference, setPreference];
}

/**
 * Styles that depend on the theme. Pass a function declared at module level
 * (`const createStyles = (t: Theme) => StyleSheet.create({...})`): it runs once per scheme.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  return cached(factory, useTheme());
}

const styleCache = new WeakMap<(theme: Theme) => unknown, Map<ColorScheme, unknown>>();

function cached<T>(factory: (theme: Theme) => T, theme: Theme): T {
  let byScheme = styleCache.get(factory);
  if (!byScheme) {
    byScheme = new Map();
    styleCache.set(factory, byScheme);
  }
  if (!byScheme.has(theme.scheme)) byScheme.set(theme.scheme, factory(theme));
  return byScheme.get(theme.scheme) as T;
}
