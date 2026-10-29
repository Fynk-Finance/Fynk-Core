import { formatCop } from '@shared/domain/money';

import { priceIncrease } from './priceChange';

const pesos = (n: number) => n * 100;

describe('priceIncrease (SCRUM-61)', () => {
  it('alerts 32.900 to 36.900 with +$4.000, as in the design', () => {
    const alert = priceIncrease(pesos(32_900), pesos(36_900));
    expect(alert).toEqual({
      previousMinor: pesos(32_900),
      newMinor: pesos(36_900),
      differenceMinor: pesos(4_000),
    });
    expect(formatCop(alert!.differenceMinor)).toBe('$4.000');
  });

  it('does not alert 32.900 to 33.500 (+600: under $1.000 and under 5 %)', () => {
    expect(priceIncrease(pesos(32_900), pesos(33_500))).toBeNull();
  });

  it('needs more than $1.000 even when that is over 5 % (cheap services)', () => {
    // 10.000 to 10.900 is +9 % but only +$900.
    expect(priceIncrease(pesos(10_000), pesos(10_900))).toBeNull();
    expect(priceIncrease(pesos(10_000), pesos(11_100))).not.toBeNull();
  });

  it('needs more than 5 % even when that is over $1.000 (expensive services)', () => {
    // 1.400.000 to 1.450.000 is +$50.000 but only +3,6 %.
    expect(priceIncrease(pesos(1_400_000), pesos(1_450_000))).toBeNull();
    expect(priceIncrease(pesos(1_400_000), pesos(1_480_000))).not.toBeNull();
  });

  it('does not alert at exactly the threshold, nor on a price drop', () => {
    expect(priceIncrease(pesos(20_000), pesos(21_000))).toBeNull(); // +$1.000 and +5 % exactly
    expect(priceIncrease(pesos(36_900), pesos(32_900))).toBeNull();
    expect(priceIncrease(pesos(32_900), pesos(32_900))).toBeNull();
  });
});
