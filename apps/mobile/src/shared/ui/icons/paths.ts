// Icon shapes copied from the design code (docs/design/sources). All use a 24 x 24 viewBox,
// a round stroke and `currentColor`, like the design. Source screen next to each group.
// The primary light dot is the same in both themes.
import { lightColors } from '../tokens';

export type IconShape =
  | { kind: 'path'; d: string; fill?: string; stroke?: false; opacity?: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number; fill?: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: false };

const p = (...ds: string[]): IconShape[] => ds.map((d) => ({ kind: 'path', d }));
// 'currentColor' is replaced by the icon color when drawing.
export const CURRENT = 'currentColor';

export const icons = {
  // Headers and navigation (VerdeDashboard, VerdeOnbNombre, VerdeDetalleCuentas)
  bell: p('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'),
  chevronLeft: p('m15 18-6-6 6-6'),
  chevronRight: p('m9 6 6 6-6 6'),
  chevronDown: p('m6 9 6 6 6-6'),
  arrowRight: p('M5 12h14', 'M13 6l6 6-6 6'),
  arrowUpRight: p('M7 17 17 7', 'M8 7h9v9'),
  arrowDownLeft: p('M17 7 7 17', 'M16 17H7V8'),
  arrowDown: p('M12 19V5M5 12l7 7 7-7'),

  // Forms (VerdeLogin, VerdeOnbNombre)
  mail: p('M4 4h16v16H4z', 'm4 7 8 6 8-6'),
  lock: [
    { kind: 'rect', x: 4, y: 11, width: 16, height: 10, rx: 2 },
    { kind: 'path', d: 'M8 11V7a4 4 0 0 1 8 0v4' },
  ],
  eye: [
    { kind: 'path', d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' },
    { kind: 'circle', cx: 12, cy: 12, r: 3 },
  ],
  eyeOff: p(
    'M3 3l18 18',
    'M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ),
  user: p('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'),
  fingerprint: p(
    'M12 11v3a8 8 0 0 1-1 4',
    'M8.5 10a3.5 3.5 0 0 1 7 1v2a12 12 0 0 1-.6 4',
    'M5.5 8.5A7 7 0 0 1 19 11v1',
    'M5 13a14 14 0 0 0 .5 3',
    'M18.5 16a16 16 0 0 0 .4-2',
    'M8.8 14a10 10 0 0 1-.6 4',
  ),

  // Actions and states (VerdeDetalleCuentas, VerdeOnbOmitir, VerdeConectarBanco)
  check: p('M20 6 9 17l-5-5'),
  plus: p('M12 5v14M5 12h14'),
  search: p('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'), // Movimientos
  close: p('M18 6 6 18M6 6l12 12'),
  trash: p(
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  ),
  warning: p(
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  ),
  shield: p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'),
  help: p('M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01'),
  logout: p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'),
  calendar: p(
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  ),
  security: p('M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'),
  sync: p('M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5'),
  bank: p('M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z'),
  card: p('M2 7h20v12H2zM2 11h20'),
  cardAlt: p('M2 6h20v12H2zM2 10h20M6 15h4'),
  chartLine: p('M3 3v18h18M7 15l4-4 3 3 5-6'),
  goal: p(
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ),

  // Movements, recurring items and subscriptions (VerdeDashboard, VerdeBilletera)
  home: p('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'),
  bolt: p('M13 2 4 14h7l-1 8 9-12h-7z'),
  phone: p('M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2'),
  gym: p('M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12'),
  play: p('M5 3l14 9-14 9z'),
  monitor: p('M4 4h16v12H4zM8 20h8M12 16v4'),
  music: p('M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'),
  cloud: p('M17.5 19H7a5 5 0 1 1 1.4-9.8A6 6 0 0 1 19.8 12 3.5 3.5 0 0 1 17.5 19z'),
  tv: p('M3 6h18v12H3zM8 21h8M7 2l5 4 5-4'),
  bus: p('M8 6v6M16 6v6M2 12h20M6 18h12M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12M7 21v-3M17 21v-3'),
  coffee: p('M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 2v3M11 2v3'),
  cart: p('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0'),
  food: p(
    'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  ),
  piggy: p(
    'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5zM2 9v1c0 1.1.9 2 2 2h1',
  ),
  plane: p(
    'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  ),

  // Bottom tab bar, outline when inactive and filled when active (VerdeDashboard,
  // VerdeBilletera, VerdeRecomendaciones, VerdeInversion)
  tabDashboard: [
    { kind: 'rect', x: 3, y: 3, width: 7, height: 9, rx: 1.5 },
    { kind: 'rect', x: 14, y: 3, width: 7, height: 5, rx: 1.5 },
    { kind: 'rect', x: 14, y: 12, width: 7, height: 9, rx: 1.5 },
    { kind: 'rect', x: 3, y: 16, width: 7, height: 5, rx: 1.5 },
  ],
  tabDashboardActive: [
    { kind: 'rect', x: 3, y: 3, width: 7, height: 9, rx: 1.5, fill: CURRENT },
    { kind: 'rect', x: 14, y: 3, width: 7, height: 5, rx: 1.5, fill: CURRENT },
    { kind: 'rect', x: 14, y: 12, width: 7, height: 9, rx: 1.5, fill: CURRENT },
    { kind: 'rect', x: 3, y: 16, width: 7, height: 5, rx: 1.5, fill: CURRENT },
  ],
  tabWallet: p(
    'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5',
    'M16 14h.01',
  ),
  tabWalletActive: [
    {
      kind: 'path',
      d: 'M17 3H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3H5.5a1.5 1.5 0 0 1 0-3H17a1 1 0 0 0 0-2z',
      fill: CURRENT,
      stroke: false,
    },
    { kind: 'circle', cx: 16.5, cy: 14, r: 1.6, fill: lightColors.primaryLight, stroke: false },
  ],
  tabRecommendations: p(
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6',
    'M10 22h4',
  ),
  tabRecommendationsActive: [
    {
      kind: 'path',
      d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5z',
      fill: CURRENT,
    },
    { kind: 'path', d: 'M9 18h6' },
    { kind: 'path', d: 'M10 22h4' },
  ],
  tabInvestment: p('m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'),
  tabInvestmentActive: [
    {
      kind: 'path',
      d: 'M2 17l6.5-6.5 5 5L22 7v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z',
      fill: CURRENT,
      stroke: false,
      opacity: 0.35,
    },
    { kind: 'path', d: 'm22 7-8.5 8.5-5-5L2 17' },
    { kind: 'path', d: 'M16 7h6v6' },
  ],
} satisfies Record<string, IconShape[]>;

export type IconName = keyof typeof icons;
