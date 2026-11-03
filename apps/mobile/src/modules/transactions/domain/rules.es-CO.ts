// Keyword rules of the categorization pipeline (step 3), for Colombian merchants and bank
// descriptions. They run on ruleText(): lowercase, no accents, every sign a space. Order matters
// and the first match wins, so a specific rule comes before a general one ("pago tarjeta"
// before "tarjeta", "metro de medellin" before "metro", "tienda de barrio" before "tienda").
import type { CategoryId } from '@shared/domain/types';

export interface KeywordRule {
  categoryId: CategoryId;
  /** Words of ruleText(); matched on word boundaries. */
  words: readonly string[];
  /** Only for money in or money out. */
  sign?: 'in' | 'out';
}

export const KEYWORD_RULES: readonly KeywordRule[] = [
  {
    categoryId: 'card_payment',
    words: ['pago tarjeta', 'pago de tarjeta', 'pago tc', 'abono tarjeta'],
  },
  {
    categoryId: 'salary',
    sign: 'in',
    words: ['nomina', 'salario', 'sueldo', 'prima de servicios'],
  },
  {
    categoryId: 'income_other',
    words: ['saldo inicial', 'reembolso', 'devolucion', 'abono intereses', 'rendimientos'],
  },
  {
    categoryId: 'savings',
    words: ['cdt', 'ahorro programado', 'bolsillo', 'fiducuenta', 'fondo de inversion'],
  },
  {
    categoryId: 'fees',
    words: ['cuota de manejo', 'comision', 'gmf', '4x1000', '4 x 1000', 'gravamen'],
  },
  { categoryId: 'rent', words: ['arriendo', 'arrendamiento', 'inmobiliaria'] },
  {
    categoryId: 'utilities',
    words: [
      'epm',
      'codensa',
      'enel',
      'vanti',
      'acueducto',
      'gas natural',
      'servicios publicos',
      'empresa de servicios',
      'emcali',
      'afinia',
      'air e',
      'aguas de',
    ],
  },
  {
    categoryId: 'telecom',
    words: ['claro', 'movistar', 'tigo', 'wom', 'etb', 'recarga celular', 'internet hogar'],
  },
  {
    categoryId: 'subscriptions',
    words: [
      'netflix',
      'spotify',
      'disney',
      'youtube',
      'icloud',
      'apple com bill',
      'prime video',
      'amazon prime',
      'hbo max',
      'paramount',
      'crunchyroll',
      'deezer',
      'google one',
      'streaming',
      'storage',
      'suscripcion',
    ],
  },
  {
    categoryId: 'transfers',
    words: ['transferencia', 'transf', 'nequi', 'daviplata', 'envio de dinero', 'giro'],
  },
  {
    categoryId: 'transport',
    words: [
      'uber',
      'didi',
      'transmilenio',
      'sitp',
      'cabify',
      'indriver',
      'taxi',
      'metro de medellin',
      'tullave',
      'recarga transporte',
      'transporte',
      'peaje',
      'parqueadero',
      'terpel',
      'primax',
      'gasolina',
    ],
  },
  {
    categoryId: 'health',
    words: [
      'drogueria',
      'farmacia',
      'cruz verde',
      'farmatodo',
      'la rebaja',
      'colsanitas',
      'eps',
      'clinica',
      'odontologia',
      'laboratorio',
    ],
  },
  { categoryId: 'gym', words: ['gimnasio', 'smart fit', 'smartfit', 'bodytech', 'gym'] },
  { categoryId: 'cinema', words: ['cine colombia', 'cinemark', 'procinal', 'royal films', 'cine'] },
  {
    categoryId: 'education',
    words: [
      'universidad',
      'colegio',
      'matricula',
      'icetex',
      'platzi',
      'coursera',
      'udemy',
      'libreria',
    ],
  },
  // Before groceries, which has "mercado".
  { categoryId: 'shopping', words: ['mercado libre', 'mercadolibre'] },
  {
    categoryId: 'groceries',
    words: [
      'exito',
      'd1',
      'ara',
      'olimpica',
      'carulla',
      'jumbo',
      'metro',
      'makro',
      'surtimax',
      'supermercado',
      'mercado',
      'tienda de barrio',
      'fruver',
      'colsubsidio',
    ],
  },
  {
    categoryId: 'restaurants',
    words: [
      'restaurante',
      'rappi',
      'ifood',
      'crepes',
      'juan valdez',
      'tostao',
      'cafe',
      'starbucks',
      'frisby',
      'kfc',
      'mcdonalds',
      'el corral',
      'burger',
      'pizza',
      'panaderia',
      'almuerzo',
      'antojos',
      'helado',
    ],
  },
  {
    categoryId: 'shopping',
    words: [
      'falabella',
      'homecenter',
      'alkosto',
      'zara',
      'arturo calle',
      'mercado libre',
      'amazon',
      'tienda',
      'compra comercio',
      'ropa',
    ],
  },
];
