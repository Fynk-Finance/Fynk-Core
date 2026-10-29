// The name of the Nombre step (SCRUM-69). The design has one field: the first word is the first
// name and the rest is the last name ("Laura Gómez Ruiz" → Laura / Gómez Ruiz). Each part follows
// the rule of PATCH /me (services/api/internal/identity/profile_http.go, validName): 1 to 50
// letters of any script, combining marks, spaces, apostrophes, hyphens and periods, starting with
// a letter and ending with a letter or a combining mark. Pure.

export interface PersonName {
  firstName: string;
  lastName?: string;
}

export type NameProblem = 'empty' | 'invalid' | 'tooLong';

export const MAX_NAME_PART = 50;

const LETTER = /\p{L}/u;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;
const ALLOWED = /^[\p{L}\p{M} '’.-]+$/u;

const words = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

/** Null when nothing was typed. */
export function splitFullName(text: string): PersonName | null {
  const [firstName, ...rest] = words(text);
  if (!firstName) return null;
  return rest.length ? { firstName, lastName: rest.join(' ') } : { firstName };
}

function partProblem(part: string): NameProblem | null {
  const chars = [...part];
  if (chars.length > MAX_NAME_PART) return 'tooLong';
  const first = chars[0] ?? '';
  const last = chars[chars.length - 1] ?? '';
  if (!ALLOWED.test(part) || !LETTER.test(first) || !LETTER_OR_MARK.test(last)) return 'invalid';
  return null;
}

/** Why the typed name cannot be saved, or null when it can. */
export function nameProblem(text: string): NameProblem | null {
  const name = splitFullName(text);
  if (!name) return 'empty';
  return partProblem(name.firstName) ?? (name.lastName ? partProblem(name.lastName) : null);
}

/** The saved name back in the single field. */
export function joinName(name: { firstName?: string; lastName?: string }): string {
  return [name.firstName, name.lastName].filter(Boolean).join(' ').trim();
}

/** "Hola, Laura!": the first word only. */
export function greetingName(text: string): string {
  return words(text)[0] ?? '';
}
