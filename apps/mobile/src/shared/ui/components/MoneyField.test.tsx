// Amount fields in COP (SCRUM-97): a "$" before the value and dot thousands while the person
// types, so `30000` reads `$ 30.000`.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { parseCopInput } from '../../domain/money';
import { formatMoneyInput, MoneyField } from './MoneyField';

describe('formatMoneyInput', () => {
  it.each([
    ['30000', '30.000'],
    ['3000', '3.000'],
    ['300', '300'],
    ['1234567', '1.234.567'],
    ['0', '0'],
    ['007', '7'],
    ['', ''],
    ['$200.000', '200.000'],
    ['30.0000', '300.000'],
    ['12a3', '123'],
    ['abc', ''],
  ])('%j → %j', (typed, shown) => {
    expect(formatMoneyInput(typed)).toBe(shown);
  });

  it('keeps at most 12 digits of pesos', () => {
    expect(formatMoneyInput('12345678901234')).toBe('123.456.789.012');
  });

  it('gives text that parseCopInput reads as the same amount', () => {
    expect(parseCopInput(formatMoneyInput('30000'))).toBe(3_000_000);
    expect(parseCopInput(formatMoneyInput('1234567'))).toBe(123_456_700);
  });
});

function Controlled({ onChange }: { onChange?: (text: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <MoneyField
      label="Monto"
      value={value}
      onChangeText={(text) => {
        setValue(text);
        onChange?.(text);
      }}
      testID="amount"
    />
  );
}

describe('MoneyField', () => {
  it('shows what is typed with dot thousands and hands back the same text', async () => {
    const onChange = jest.fn();
    await render(<Controlled onChange={onChange} />);
    await fireEvent.changeText(screen.getByTestId('amount'), '30000');
    expect(onChange).toHaveBeenLastCalledWith('30.000');
    expect(screen.getByTestId('amount')).toHaveDisplayValue('30.000');
    // Deleting a digit keeps the format.
    await fireEvent.changeText(screen.getByTestId('amount'), '30.00');
    expect(screen.getByTestId('amount')).toHaveDisplayValue('3.000');
  });

  it('has the "$" before the value and the number pad', async () => {
    await render(<Controlled />);
    // Read by sight only: the label already says what the field is.
    expect(screen.getByText('$', { includeHiddenElements: true })).toBeTruthy();
    const input = screen.getByLabelText('Monto');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.inputMode).toBe('numeric');
  });

  it('formats a prefilled value, with or without its "$"', async () => {
    const { rerender } = await render(
      <MoneyField label="Monto" value="$200.000" onChangeText={() => undefined} testID="m" />,
    );
    expect(screen.getByTestId('m')).toHaveDisplayValue('200.000');
    await rerender(
      <MoneyField label="Monto" value="1400000" onChangeText={() => undefined} testID="m" />,
    );
    expect(screen.getByTestId('m')).toHaveDisplayValue('1.400.000');
  });
});
