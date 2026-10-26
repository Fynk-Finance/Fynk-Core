// Design tokens of "App azul y verde" (owned by M0).
// Values come from docs/design/README.md (Design tokens) and, where the table has no entry,
// from the design code in docs/design/source/ (file named next to the value).
// Modules never hardcode a color, font or size: they use these tokens or the components.

export const colors = {
  // README tokens table
  primary: '#2FA8D8',
  primaryPressed: '#279DCC',
  primaryDark: '#1F93C2',
  primaryDeep: '#177FA9',
  primaryLight: '#50C1EB',
  headerShapeA: '#3AB3E3',
  headerShapeB: '#47B6E2',
  surfaceBlue: '#E4F5FC',
  surfaceBlueSoft: '#F4FBFE',
  focusRing: '#B5E5F7',
  accent: '#A8E03A',
  accentPressed: '#93CC26',
  accentSoft: '#D4F294',
  accentPale: '#F4FBE3',
  link: '#6A9E12',
  linkStrong: '#5A8A0C',
  textPrimary: '#0F2233',
  textSecondary: '#5E7482',
  textPlaceholder: '#8A9BA6',
  divider: '#EDF1F4',
  border: '#E4ECF0',
  danger: '#C0392B',
  dangerSoft: '#FDEAEA',
  background: '#FFFFFF',

  // From the design code
  white: '#FFFFFF',
  cardShapeLight: '#6BCCEF', // decorative squares on light blue cards (VerdeBilletera)
  cardShapeLighter: '#86D6F3', // (VerdeBilletera)
  accentTint: '#F1FADF', // "Poco uso" and "Mayor impacto" chips (VerdeBilletera, VerdeRecomendaciones)
  accentSurface: '#F8FDEE', // dashed "Conectar otra tarjeta" card (VerdeDetalleCuentas)
  dangerBorder: '#F3C7C7', // "Eliminar cuenta" button (VerdeDetalleCuentas)
  dangerSurface: '#FFF5F5', // "Eliminar cuenta" button (VerdeDetalleCuentas)
  onPrimaryMuted: 'rgba(255, 255, 255, 0.72)', // inactive tab (VerdeDashboard)
  onPrimaryTrack: 'rgba(255, 255, 255, 0.32)', // onboarding step track (VerdeOnbNombre)
  onPrimaryOverlay: 'rgba(255, 255, 255, 0.2)', // back button on blue (VerdeOnbNombre)
  onPrimarySubtle: 'rgba(255, 255, 255, 0.22)', // income and spending boxes (VerdeDashboard)
  onPrimaryBadge: 'rgba(255, 255, 255, 0.28)', // "Mayor impacto" pill (VerdeRecomendaciones)
} as const;

export type ColorToken = keyof typeof colors;

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
// expressed, so the radius is reduced instead).
export const shadow = {
  card: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
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
