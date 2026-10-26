// normalizeMerchant (00-shared-contracts.md, section 2). Used by M7 (categories) and M9
// (recurring detection), so the same raw text always gives the same key in both.
// Lowercases, strips accents, removes digits, card suffixes and city words, collapses spaces.

// Words banks add about the card or the payment channel. Matched as whole words.
export const CARD_WORDS: readonly string[] = [
  'tarj',
  'tarjeta',
  'tdc',
  'tc',
  'td',
  'pos',
  'debito',
  'credito',
  'visa',
  'mastercard',
  'amex',
];

// Colombian cities and country words that banks append to the merchant name.
// Multi-word entries are matched as whole phrases.
export const CITY_WORDS: readonly string[] = [
  'bogota d c',
  'bogota dc',
  'santa marta',
  'bogota',
  'bta',
  'medellin',
  'mde',
  'cali',
  'barranquilla',
  'cartagena',
  'bucaramanga',
  'pereira',
  'manizales',
  'cucuta',
  'ibague',
  'villavicencio',
  'pasto',
  'monteria',
  'neiva',
  'armenia',
  'popayan',
  'tunja',
  'valledupar',
  'sincelejo',
  'chia',
  'envigado',
  'itagui',
  'bello',
  'soacha',
  'rionegro',
  'colombia',
  'col',
];

const REMOVABLE = [...CITY_WORDS, ...CARD_WORDS].sort((a, b) => b.length - a.length);
const REMOVABLE_PATTERN = new RegExp(`(?:^| )(?:${REMOVABLE.join('|')})(?= |$)`, 'g');

export function normalizeMerchant(raw: string): string {
  const words = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents
    .toLowerCase()
    .replace(/\d+/g, '') // digits, including card suffixes like *4821
    .replace(/[^a-z\s]+/g, ' ') // punctuation and symbols become spaces
    .replace(/\s+/g, ' ')
    .trim();
  return ` ${words} `.replace(REMOVABLE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}
