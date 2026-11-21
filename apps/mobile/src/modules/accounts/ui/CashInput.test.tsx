import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { MoneyMinor } from '@shared/domain/types';

import { parseCashInput } from '../domain/cash';
import { CashInput } from './CashInput';

function Harness({ initial = null }: { initial?: MoneyMinor | null }) {
  const [value, setValue] = useState<MoneyMinor | null>(initial);
  return <CashInput value={value} onChange={setValue} />;
}

describe('CashInput', () => {
  it('is labeled "¿Cuánto tienes en efectivo?"', async () => {
    await render(<Harness />);
    expect(screen.getByLabelText('¿Cuánto tienes en efectivo?')).toBeTruthy();
  });

  it('shows the amount with dot thousands as the person types', async () => {
    await render(<Harness />);
    await fireEvent.changeText(screen.getByTestId('accounts.cashInput'), '600000');
    expect(screen.getByTestId('accounts.cashInput').props.value).toBe('600.000');
  });

  it('shows a saved amount and empties when cleared', async () => {
    const onChange = jest.fn();
    await render(<CashInput value={60_000_000} onChange={onChange} />);
    expect(screen.getByTestId('accounts.cashInput').props.value).toBe('600.000');

    await fireEvent.changeText(screen.getByTestId('accounts.cashInput'), '');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows an error', async () => {
    await render(<CashInput value={null} onChange={jest.fn()} error="Escribe un valor." />);
    expect(screen.getByText('Escribe un valor.')).toBeTruthy();
  });
});

describe('parseCashInput', () => {
  it.each([
    ['600.000', 60_000_000],
    ['600000', 60_000_000],
    ['$ 1.250.000', 125_000_000],
    ['0', 0],
    ['007', 700],
    ['', null],
    ['abc', null],
  ])('reads %p as %p centavos', (text, expected) => {
    expect(parseCashInput(text)).toBe(expected);
  });

  it('keeps at most 12 digits of pesos', () => {
    expect(parseCashInput('1234567890123')).toBe(123_456_789_012 * 100);
  });
});
