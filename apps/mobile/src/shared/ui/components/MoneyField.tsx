// Amount field in COP (SCRUM-97): the TextField of the money fields of the design (OnbCuentas,
// OnbGastos, OnbMetas) with the "$" before the value and dot thousands while the person types, so
// `30000` reads `$ 30.000`. Whole pesos only, with the number pad. The text it hands back is what
// it shows (`30.000`), which parseCopInput reads.
import { TextField, type TextFieldProps } from './TextField';

/** Most digits of pesos, as the cash field (a trillion pesos is far above any balance). */
const MAX_PESO_DIGITS = 12;

/** `30000` → `30.000`, `$200.000` → `200.000`, `007` → `7`. Digits only; empty stays empty. */
export function formatMoneyInput(text: string): string {
  const digits = text
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAX_PESO_DIGITS);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export type MoneyFieldProps = Omit<TextFieldProps, 'prefix' | 'keyboardType' | 'inputMode'>;

export function MoneyField({ value, defaultValue, onChangeText, ...field }: MoneyFieldProps) {
  return (
    <TextField
      {...field}
      prefix="$"
      keyboardType="number-pad"
      inputMode="numeric"
      value={value === undefined ? undefined : formatMoneyInput(value)}
      defaultValue={defaultValue === undefined ? undefined : formatMoneyInput(defaultValue)}
      onChangeText={onChangeText ? (next) => onChangeText(formatMoneyInput(next)) : undefined}
    />
  );
}
