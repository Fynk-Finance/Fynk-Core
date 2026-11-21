// The tabs' shared blue header (QA review 2026-11-07, G2, SCRUM-89). Criteria:
// 1. on a tab change the header stays and animates its height to the new tab's;
// 2. the greeting does not jump and each tab's own content fades;
// 3. during a swipe it follows the finger (the pager's position, fractional while swiping);
// 4. with Reduce Motion the change is immediate.
import {
  blend,
  fillUnknown,
  flickTarget,
  layerOpacity,
  nearestTab,
  UNKNOWN,
} from './tabHeaderBlend';

describe('blend (criteria 1 and 3)', () => {
  it('gives each tab its own value at rest', () => {
    expect(blend(0, [200, 300, 120], false)).toBe(200);
    expect(blend(1, [200, 300, 120], false)).toBe(300);
    expect(blend(2, [200, 300, 120], false)).toBe(120);
  });

  it('moves between the two tabs with the finger', () => {
    expect(blend(0.5, [200, 300], false)).toBe(250);
    expect(blend(0.25, [200, 300], false)).toBe(225);
    expect(blend(1.75, [200, 300, 100], false)).toBe(150);
  });

  it('stays inside the first and last tab when the pager overshoots', () => {
    expect(blend(-0.2, [200, 300], false)).toBe(200);
    expect(blend(1.3, [200, 300], false)).toBe(300);
  });

  it('jumps to the nearest tab with Reduce Motion (criterion 4)', () => {
    expect(blend(0.4, [200, 300], true)).toBe(200);
    expect(blend(0.6, [200, 300], true)).toBe(300);
  });
});

describe('fillUnknown', () => {
  it('lends a tab not measured yet the height of its nearest measured tab', () => {
    // A lazy tab opened for the first time: the card keeps its height during that swipe.
    expect(fillUnknown([UNKNOWN, 180, UNKNOWN, UNKNOWN])).toEqual([180, 180, 180, 180]);
    expect(fillUnknown([100, UNKNOWN, 300])).toEqual([100, 100, 300]);
    expect(fillUnknown([UNKNOWN, UNKNOWN])).toEqual([0, 0]);
  });
});

describe('layerOpacity (criterion 2)', () => {
  it.each([
    [0, 1],
    [0.25, 0.5],
    [0.5, 0],
    [0.75, 0],
    [1, 0],
  ])('at %p from its tab the content shows at %p', (distance, opacity) => {
    expect(layerOpacity(2 + distance, 2, false)).toBeCloseTo(opacity);
    expect(layerOpacity(2 - distance, 2, false)).toBeCloseTo(opacity);
  });

  it('is only on or off with Reduce Motion (criterion 4)', () => {
    expect(layerOpacity(1.4, 1, true)).toBe(1);
    expect(layerOpacity(1.6, 1, true)).toBe(0);
    expect(layerOpacity(1.6, 2, true)).toBe(1);
  });
});

describe('nearestTab', () => {
  it('rounds the position inside the tabs', () => {
    expect(nearestTab(1.49, 4)).toBe(1);
    expect(nearestTab(1.5, 4)).toBe(2);
    expect(nearestTab(-0.3, 4)).toBe(0);
    expect(nearestTab(3.4, 4)).toBe(3);
  });
});

describe('flickTarget (a sideways flick on the header)', () => {
  it('goes to the next tab on a flick to the left and to the previous one to the right', () => {
    expect(flickTarget(1, 4, -80, 0)).toBe(2);
    expect(flickTarget(1, 4, 80, 0)).toBe(0);
    expect(flickTarget(1, 4, -20, -900)).toBe(2);
    expect(flickTarget(1, 4, 20, 900)).toBe(0);
  });

  it('does nothing on a short slow drag', () => {
    expect(flickTarget(1, 4, -40, -200)).toBeNull();
  });

  it('follows the distance when the finger turned back before lifting', () => {
    expect(flickTarget(1, 4, -90, 600)).toBe(2);
  });

  it('stops at the first and last tab', () => {
    expect(flickTarget(0, 4, 90, 0)).toBeNull();
    expect(flickTarget(3, 4, -90, 0)).toBeNull();
  });
});
