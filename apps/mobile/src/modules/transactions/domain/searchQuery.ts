// "Buscar por nombre" (HU-017): what the person types becomes an FTS5 query where every word is
// a prefix ("super" finds "Supermercado"). The index folds case and accents, and FTS5 runs the
// query through the same tokenizer, so "SUPERMERC" and "supermércado" match too. Each word is
// quoted, so FTS5 syntax ("AND", "*", quotes, parentheses) typed by the person is only text.
const MAX_WORDS = 8;

export function toFtsQuery(text: string): string | null {
  const words = text
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, MAX_WORDS);
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"*`).join(' ');
}
