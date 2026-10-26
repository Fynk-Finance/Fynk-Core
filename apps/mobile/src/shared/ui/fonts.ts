// The three design fonts, loaded with expo-font (one family per weight, see tokens.fonts).
// Each weight is imported from its own entry point, so only these 8 files are bundled.
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';

export const fontAssets = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

/** True once every design font is ready. The app root waits for it before rendering. */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  // On a font error the app still renders, with the platform font.
  return loaded || error !== null;
}
