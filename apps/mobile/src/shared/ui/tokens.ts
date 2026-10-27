// Design tokens of "App azul y verde" (owned by M0).
// Values come from docs/design/README.md (Design tokens, light and dark) and, where the table has
// no entry, from the design code in docs/design/sources/ (file named next to the value).
// Modules never hardcode a color, font or size: they read the active palette with useTheme()
// (./theme) or use the components.

export const lightColors = {
  // README tokens table
  primary: '#2FA8D8',
  primaryPressed: '#279DCC',
  primaryDark: '#1F93C2',
  primaryDeep: '#177FA9',
  primaryLight: '#50C1EB',
  headerShapeA: '#3AB3E3',
  headerShapeB: '#47B6E2',
  headerDashboard: '#2FA8D8',
  pullTab: '#47B6E2',
  surfaceBlue: '#E4F5FC',
  borderBlue: '#E4F5FC',
  borderBlueStrong: '#BFE6F6',
  surfaceBlueSoft: '#F4FBFE',
  focusRing: '#B5E5F7',
  focusRingOnPrimary: '#DCF5A8',
  accent: '#A8E03A',
  accentPressed: '#93CC26',
  accentStroke: '#8FC426',
  accentSoft: '#D4F294',
  accentPale: '#F4FBE3',
  accentTint: '#F1FADF',
  accentSurface: '#F8FDEE',
  accentText: '#4F7A0B',
  link: '#6A9E12',
  linkStrong: '#5A8A0C',
  textPrimary: '#0F2233',
  textBody: '#33495A',
  textSecondary: '#5E7482',
  textPlaceholder: '#8A9BA6',
  divider: '#EDF1F4',
  border: '#E4ECF0',
  trackOff: '#CFDBE3',
  controlBorder: '#C9D6DE',
  danger: '#C0392B',
  dangerPressed: '#A93226',
  dangerSoft: '#FDEAEA',
  dangerSurface: '#FFF5F5',
  dangerBorder: '#F3C7C7',
  background: '#FFFFFF',
  canvas: '#FFFFFF',
  onPrimary: '#FFFFFF',
  shadow: '#0F2233',

  // From the design code, the same in both themes
  cardShapeLight: '#6BCCEF', // decorative squares on light blue cards (Billetera)
  cardShapeLighter: '#86D6F3', // (Billetera)
  onPrimaryMuted: 'rgba(255, 255, 255, 0.72)', // inactive tab (Dashboard)
  onPrimaryTrack: 'rgba(255, 255, 255, 0.32)', // onboarding step track (OnbNombre)
  onPrimaryOverlay: 'rgba(255, 255, 255, 0.2)', // back button on blue (OnbNombre)
  onPrimarySubtle: 'rgba(255, 255, 255, 0.22)', // income and spending boxes (Dashboard)
  onPrimaryBadge: 'rgba(255, 255, 255, 0.28)', // "Mayor impacto" pill (Recomendaciones)
} as const;

export type PaletteToken = keyof typeof lightColors;
/** `white` is deprecated with `colors` below and goes away with it. */
export type ColorToken = PaletteToken | 'white';
export type Palette = Record<PaletteToken, string>;

/** The dark twin of every light color (docs/design/sources/dark/, README tokens table). */
export const darkColors: Palette = {
  ...lightColors,
  primaryDark: '#62C8F0',
  primaryDeep: '#62C8F0',
  headerDashboard: '#428FAF',
  pullTab: '#418EAE',
  surfaceBlue: '#1A3444',
  borderBlue: '#223746',
  borderBlueStrong: '#2B5267',
  surfaceBlueSoft: '#182A37',
  accentTint: '#223318',
  accentSurface: '#1E2C16',
  accentText: '#B6E45A',
  link: '#B6E45A',
  linkStrong: '#B6E45A',
  textPrimary: '#E8F1F6',
  textBody: '#BCCBD4',
  textSecondary: '#97ABB8',
  textPlaceholder: '#71889A',
  divider: '#22313D',
  border: '#22313D',
  trackOff: '#344755',
  danger: '#FF7D6E',
  dangerSoft: '#3A1E20',
  dangerSurface: '#2E1A1C',
  dangerBorder: '#5A2A2A',
  background: '#13212D',
  canvas: '#0B1620',
  shadow: '#000000',
};

export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, Palette> = { light: lightColors, dark: darkColors };

// expo-font registers one family name per weight (see fonts.ts).
export const fonts = {
  body: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
  },
  heading: {
    medium: 'SpaceGrotesk_500Medium',
    bold: 'SpaceGrotesk_700Bold',
  },
  amount: {
    medium: 'IBMPlexMono_500Medium',
    semibold: 'IBMPlexMono_600SemiBold',
  },
} as const;

// README sizes, plus 9, 18, 24, 30, 32 and 38 used in the design code.
export const fontSize = {
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  17: 17,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
  28: 28,
  30: 30,
  32: 32,
  34: 34,
  38: 38,
} as const;

export type FontSize = keyof typeof fontSize;

// Line height used next to each size in the design code.
export const lineHeight: Record<FontSize, number> = {
  9: 12,
  10: 13,
  11: 14,
  12: 16,
  13: 18,
  14: 20,
  15: 20,
  16: 21,
  17: 22,
  18: 22,
  20: 26,
  22: 28,
  24: 30,
  26: 32,
  28: 34,
  30: 36,
  32: 38,
  34: 40,
  38: 44,
};

export const radius = {
  pill: 999,
  sheet: 32,
  sheetSm: 24,
  cardLg: 20,
  card: 18,
  button: 16,
  input: 14,
  tileLg: 14,
  tile: 12,
  tileSm: 10,
  tileXs: 8,
} as const;

export const size = {
  screenWidth: 390,
  screenHeight: 844,
  buttonPrimary: 56,
  buttonSecondary: 52,
  iconButton: 48,
  backButton: 44,
  input: 56,
  chip: 36,
  tabBar: 72,
  avatar: 38,
} as const;

export const spacing = {
  screen: 20, // horizontal padding of every screen
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  section: 18,
  block: 22,
  tabBarClearance: 104, // bottom padding of scroll views above the tab bar
} as const;

export const motion = {
  // `ease` transitions of 0.15 to 0.25 s
  fast: 150,
  base: 200,
  slow: 250,
  // `ease-out` entrances of 0.5 to 0.7 s
  enter: 600,
  // `ease-in-out` loops of 3 to 8 s
  shine: 7000,
  shineDelay: 1500,
  float: 6000,
} as const;

// CSS box-shadows of the design translated to React Native (negative spread cannot be
// expressed, so the radius is reduced instead). Ink shadows use `colors.shadow`: the design's
// rgba(15,34,51,a) becomes rgba(0,0,0,a) in dark with the same alpha. Lime shadows do not change.
export function makeShadows(colors: Palette) {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 2,
    },
    header: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 4,
    },
    ...limeShadows,
  } as const;
}

export type Shadows = ReturnType<typeof makeShadows>;

const limeShadows = {
  accentButton: {
    shadowColor: '#7FB81A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  tabBar: {
    shadowColor: '#7FB81A',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

export const shadows: Record<ColorScheme, Shadows> = {
  light: makeShadows(lightColors),
  dark: makeShadows(darkColors),
};

/**
 * @deprecated Light only. Kept until the components move to useTheme() (M0 Step 7.2, part 2),
 * then removed. New code reads colors with useTheme().
 */
export const colors = { ...lightColors, white: '#FFFFFF' } as const;
/** @deprecated Light only, see `colors`. */
export const shadow = shadows.light;
