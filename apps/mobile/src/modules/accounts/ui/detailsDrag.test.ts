// QA review 2026-11-07, G1 (SCRUM-88): dragging the header opens or closes Detalle de cuentas
// gradually, following the finger, and lets go open or closed.
import { dragOpenness, settleOpenness } from './detailsDrag';

describe('dragOpenness', () => {
  it('follows the finger: half the panel down opens it half', () => {
    expect(dragOpenness(0, 100, 200)).toBe(0.5);
    expect(dragOpenness(1, -50, 200)).toBe(0.75);
  });

  it('stays between closed and open', () => {
    expect(dragOpenness(0, -80, 200)).toBe(0);
    expect(dragOpenness(1, 300, 200)).toBe(1);
  });

  it('does not move before the panel has a height', () => {
    expect(dragOpenness(0, 120, 0)).toBe(0);
  });
});

describe('settleOpenness', () => {
  it('goes to the nearest end on a slow release', () => {
    expect(settleOpenness(0.6, 0)).toBe(1);
    expect(settleOpenness(0.4, 0)).toBe(0);
  });

  it('follows a flick, whatever the position', () => {
    expect(settleOpenness(0.1, 800)).toBe(1);
    expect(settleOpenness(0.9, -800)).toBe(0);
  });
});
