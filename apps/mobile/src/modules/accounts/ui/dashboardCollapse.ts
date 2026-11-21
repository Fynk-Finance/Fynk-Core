// How the Dashboard header shrinks while the page scrolls (QA review 2026-11-07, G3), as the
// Estadísticas card does. One pixel of scroll takes one pixel off the header, so the page stays
// attached under it: an open Detalle de cuentas folds first, then the balance card shrinks to a
// compact one-line card. The header then stays at about a fifth of the screen. Pure; worklets.
import { size, spacing } from '@shared/ui';

/** The balance card of the design is 206 px high. */
export const CARD_OPEN = 206;

/**
 * The blue header around the card: top padding, the greeting row, the gap above the card and the
 * bottom padding (HeaderBlue). The top inset is added on top.
 */
export const HEADER_CHROME = spacing.screen + size.iconButton + spacing.xl + spacing.screen;

const MIN_CARD = 56;

/** The compact card's height, so that the shrunk header is a fifth of the screen. */
export function compactCardHeight(windowHeight: number): number {
  const fifth = Math.round(windowHeight / 5) - HEADER_CHROME;
  return Math.min(Math.round(CARD_OPEN / 2), Math.max(MIN_CARD, fifth));
}

export interface CollapseInput {
  scrollY: number;
  cardClosed: number;
  /** Natural height of Detalle de cuentas, 0 without it. */
  panelHeight: number;
  /** 0 closed, 1 open, in between while it opens or closes. */
  panelOpen: number;
}

export interface CollapseState {
  /** Height of the balance card. */
  card: number;
  /** Height of Detalle de cuentas that still shows. */
  panel: number;
  /** 0 with the full card, 1 with the compact one. */
  compact: number;
  /** Scroll it takes to shrink the header all the way. */
  distance: number;
}

export function collapse({
  scrollY,
  cardClosed,
  panelHeight,
  panelOpen,
}: CollapseInput): CollapseState {
  'worklet';
  const panelFull = panelHeight * panelOpen;
  const cardRange = CARD_OPEN - cardClosed;
  const y = Math.max(0, scrollY);
  const panelShrink = Math.min(y, panelFull);
  const cardShrink = Math.min(y - panelShrink, cardRange);
  return {
    card: CARD_OPEN - cardShrink,
    panel: panelFull - panelShrink,
    compact: cardRange > 0 ? cardShrink / cardRange : 1,
    distance: panelFull + cardRange,
  };
}
