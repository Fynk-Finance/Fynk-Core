// QA review 2026-11-07, G3 (SCRUM-90): the Dashboard header shrinks while the page scrolls.
import { CARD_OPEN, collapse, compactCardHeight, HEADER_CHROME } from './dashboardCollapse';

const closed = 69;
const at = (scrollY: number, panelHeight = 0, panelOpen = 0) =>
  collapse({ scrollY, cardClosed: closed, panelHeight, panelOpen });

describe('collapse', () => {
  it('keeps everything open at the top, and when pulled past it', () => {
    expect(at(0)).toEqual({ card: CARD_OPEN, panel: 0, compact: 0, distance: CARD_OPEN - closed });
    expect(at(-40)).toEqual(at(0));
  });

  it('shrinks the card with the scroll, one pixel per pixel', () => {
    expect(at(50)).toMatchObject({ card: CARD_OPEN - 50, compact: 50 / (CARD_OPEN - closed) });
  });

  it('stops at the compact card once scrolled past the distance', () => {
    expect(at(1000)).toMatchObject({ card: closed, compact: 1 });
  });

  it('folds an open Detalle de cuentas first, then the card', () => {
    expect(at(0, 200, 1)).toMatchObject({ panel: 200, card: CARD_OPEN, distance: 200 + 137 });
    expect(at(120, 200, 1)).toMatchObject({ panel: 80, card: CARD_OPEN, compact: 0 });
    expect(at(250, 200, 1)).toMatchObject({ panel: 0, card: CARD_OPEN - 50 });
  });

  it('counts a half open panel by what shows of it', () => {
    expect(at(0, 200, 0.5)).toMatchObject({ panel: 100, distance: 100 + 137 });
  });
});

describe('compactCardHeight', () => {
  it('leaves the shrunk header at a fifth of the screen', () => {
    expect(compactCardHeight(844)).toBe(69);
    expect(HEADER_CHROME + compactCardHeight(844)).toBe(Math.round(844 / 5));
  });

  it('never goes under one line nor over half the card', () => {
    expect(compactCardHeight(500)).toBe(56);
    expect(compactCardHeight(2000)).toBe(103);
  });
});
