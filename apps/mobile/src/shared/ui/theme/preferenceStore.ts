// Where the theme choice is kept: plain app storage, outside the vault, so the lock screen is
// themed before unlock. It is not personal data and is not backed up (CLAUDE.md, Where data lives).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_THEME_PREFERENCE, isThemePreference, type ThemePreference } from './scheme';

export const THEME_PREFERENCE_KEY = 'ui.themePreference';

export interface ThemePreferenceStore {
  load(): Promise<ThemePreference>;
  save(preference: ThemePreference): Promise<void>;
}

/** Unknown or unreadable values fall back to `system`, so a bad write never breaks the app. */
export const asyncStorageThemeStore: ThemePreferenceStore = {
  async load() {
    try {
      const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
    } catch {
      return DEFAULT_THEME_PREFERENCE;
    }
  },
  async save(preference) {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  },
};
