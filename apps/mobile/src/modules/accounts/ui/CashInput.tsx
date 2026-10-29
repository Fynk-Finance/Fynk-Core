// Cash field of OnbCuentas (onboarding step 3) and "Editar efectivo": the cash icon, "$" and the
// amount in whole pesos with dot thousands (`600.000`). The parent saves it with setCash().
import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import { TextField } from '@shared/ui';

import { parseCashInput } from '../domain/cash';
import { accountsStrings } from './strings.es-CO';

export interface CashInputProps {
  /** Centavos, or null while the field is empty. */
  value: MoneyMinor | null;
  onChange: (value: MoneyMinor | null) => void;
  error?: string;
  autoFocus?: boolean;
  testID?: string;
}

const t = accountsStrings.cash;

export function CashInput({
  value,
  onChange,
  error,
  autoFocus,
  testID = 'accounts.cashInput',
}: CashInputProps) {
  // formatCop gives `$600.000`; the field already shows the "$".
  const text = value === null ? '' : formatCop(value).slice(1);
  return (
    <TextField
      label={t.label}
      icon="cash"
      prefix="$"
      placeholder={t.placeholder}
      keyboardType="number-pad"
      inputMode="numeric"
      value={text}
      onChangeText={(next) => onChange(parseCashInput(next))}
      error={error}
      autoFocus={autoFocus}
      testID={testID}
    />
  );
}
