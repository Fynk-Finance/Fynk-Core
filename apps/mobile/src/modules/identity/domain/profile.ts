// Profile rules of the identity module (Mi cuenta). Pure: no I/O, no clock of its own.
import type { IsoDateTime } from '@shared/domain/types';

/** The person's profile as the API returns it. The email is already masked (`ca•••@correo.com`). */
export interface Profile {
  id: string;
  /** Masked by the API. Shown as it comes, never unmasked. */
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: IsoDateTime;
  /** When the password was last set. Absent when the API does not know. */
  passwordUpdatedAt?: IsoDateTime;
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

const words = (value: string | undefined): string[] =>
  (value ?? '').trim().split(/\s+/).filter(Boolean);

/** First letter or digit of a word, as a whole code point, so emoji and accents never split. */
function firstLetter(word: string): string {
  const match = /[\p{L}\p{N}]/u.exec(word);
  return match ? match[0].toLocaleUpperCase('es-CO') : '';
}

/** "María José", "Gómez Pérez" → "MP". Words without letters (emoji) are skipped. Max 2 letters. */
export function initialsOf(firstName?: string, lastName?: string): string {
  const first = words(firstName).map(firstLetter).find(Boolean) ?? '';
  const last = words(lastName).map(firstLetter).reverse().find(Boolean) ?? '';
  return first + last;
}

/** "Camila Rojas". Empty when the person has no name; the screen then shows a neutral fallback. */
export function displayNameOf(firstName?: string, lastName?: string): string {
  return [...words(firstName), ...words(lastName)].join(' ');
}

/** "octubre de 2026": the month and year of `createdAt` in America/Bogota. '' if it is not a date. */
export function memberSince(createdAt: IsoDateTime): string {
  const time = Date.parse(createdAt);
  if (Number.isNaN(time)) return '';
  const bogota = new Date(time + BOGOTA_OFFSET_MS);
  return `${MONTHS[bogota.getUTCMonth()]} de ${bogota.getUTCFullYear()}`;
}
