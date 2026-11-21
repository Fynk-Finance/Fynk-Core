// Money helpers (00-shared-contracts.md, section 1). Amounts are MoneyMinor: integer COP centavos.
// Pure functions, integer math only, no Intl (its es-CO data differs between engines).
import type { MoneyMinor } from './types';

const CENTAVOS_PER_PESO = 100;

function assertMinor(minor: MoneyMinor): void {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Money must be an integer number of centavos, got ${minor}`);
  }
}

// Whole pesos, rounding half centavo amounts away from zero.
function toWholePesos(absMinor: number): number {
  return Math.floor((absMinor + CENTAVOS_PER_PESO / 2) / CENTAVOS_PER_PESO);
}

function groupThousands(pesos: number): string {
  const digits = String(pesos);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += '.';
  }
  return out;
}

/** `1248035000` → `$12.480.350`. Negative amounts print `-$184.300`. No decimals. */
export function formatCop(minor: MoneyMinor): string {
  assertMinor(minor);
  const pesos = toWholePesos(Math.abs(minor));
  const sign = minor < 0 && pesos > 0 ? '-' : '';
  return `${sign}$${groupThousands(pesos)}`;
}

/** `520000000` → `+$5.200.000`, `-18430000` → `-$184.300`, zero → `$0`. */
export function formatCopSigned(minor: MoneyMinor): string {
  const text = formatCop(minor);
  return minor > 0 && text !== '$0' ? `+${text}` : text;
}

// Optional sign, optional $, integer part as plain digits or dot-grouped thousands,
// optional decimal comma with 1 or 2 digits.
const COP_INPUT = /^([+-]?)\$?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Parses what a user typed into MoneyMinor. `$12.480.350` → `1248035000`, `12480350` →
 * `1248035000`, `1.500,50` → `150050`. Returns null for anything else.
 */
export function parseCopInput(input: string): MoneyMinor | null {
  const compact = input.replace(/\s+/g, '');
  const match = COP_INPUT.exec(compact);
  if (!match) return null;
  const [, sign, integerPart = '', decimals = ''] = match;
  const pesos = Number(integerPart.replace(/\./g, ''));
  const centavos = Number(decimals.padEnd(2, '0'));
  const minor = pesos * CENTAVOS_PER_PESO + centavos;
  if (!Number.isSafeInteger(minor)) return null;
  return sign === '-' ? -minor : minor;
}
