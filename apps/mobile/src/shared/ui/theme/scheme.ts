// Which palette is active (shared contracts 3.6). Pure, so it is tested without React.
import type { ColorScheme } from '../tokens';

/** `system` follows the phone. The person can pick Claro or Oscuro in Mi cuenta › Apariencia. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * The scheme to draw with. The phone may report no preference (`null` or `unspecified`):
 * the design starts in light, so that is the fallback.
 */
export function resolveScheme(
  preference: ThemePreference,
  phoneScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return phoneScheme === 'dark' ? 'dark' : 'light';
}
