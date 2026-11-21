// Cash field of OnbCuentas (onboarding step 3) and "Editar efectivo": the cash icon, "$" and the
// amount in whole pesos with dot thousands (`600.000`), from the shared MoneyField (SCRUM-97).
// The parent saves it with setCash().
import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import { MoneyField } from '@shared/ui';

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
  // MoneyField drops the "$" of formatCop and shows `600.000` after its own "$".
  const text = value === null ? '' : formatCop(value);
  return (
    <MoneyField
      label={t.label}
      icon="cash"
      placeholder={t.placeholder}
      value={text}
      onChangeText={(next) => onChange(parseCashInput(next))}
      error={error}
      autoFocus={autoFocus}
      testID={testID}
    />
  );
}
