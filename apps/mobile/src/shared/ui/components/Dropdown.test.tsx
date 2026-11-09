// The dropdown of the category fields (QA review 2026-11-07, V11).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CATEGORY_IDS } from '../../domain/categories';
import { CATEGORY_ICONS, categoryOptions } from '../icons/categoryIcons';
import { ThemeProvider } from '../theme';
import { darkColors, lightColors } from '../tokens';
import { Dropdown } from './Dropdown';

const noStore = { load: async () => 'dark' as const, save: async () => {} };

const options = [
  { value: 'rent', label: 'Arriendo', icon: 'home' },
  { value: 'groceries', label: 'Mercado', icon: 'cart' },
  { value: 'transport', label: 'Transporte', icon: 'bus' },
] as const;

it('shows the chosen option, closed, and opens the list on a tap', async () => {
  await render(
    <Dropdown
      label="Categoría"
      options={[...options]}
      value="groceries"
      onChange={() => {}}
      testID="cat"
    />,
  );
  const field = screen.getByRole('button', { name: 'Categoría: Mercado' });
  expect(field).not.toBeExpanded();
  expect(screen.queryByTestId('cat.rent')).toBeNull();

  await fireEvent.press(field);
  expect(field).toBeExpanded();
  expect(screen.getByRole('radio', { name: 'Arriendo' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Mercado' })).toBeChecked();
});

it('reports the picked option and closes', async () => {
  const onChange = jest.fn();
  await render(
    <Dropdown
      label="Categoría"
      options={[...options]}
      value="groceries"
      onChange={onChange}
      testID="cat"
    />,
  );
  await fireEvent.press(screen.getByTestId('cat'));
  await fireEvent.press(screen.getByTestId('cat.transport'));
  expect(onChange).toHaveBeenCalledWith('transport');
  expect(screen.queryByTestId('cat.rent')).toBeNull();
});

it('shows the placeholder while nothing is chosen', async () => {
  await render(
    <Dropdown
      label="Categoría"
      options={[...options]}
      value={null}
      onChange={() => {}}
      placeholder="Elige una categoría"
    />,
  );
  expect(screen.getByRole('button', { name: 'Categoría: Elige una categoría' })).toBeOnTheScreen();
});

it('offers a first row that clears the choice, checked while nothing is chosen', async () => {
  const onClear = jest.fn();
  await render(
    <Dropdown
      label="Categoría"
      options={[...options]}
      value={null}
      onChange={() => {}}
      noneLabel="Sin categoría"
      onClear={onClear}
      testID="cat"
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Categoría: Sin categoría' }));
  expect(screen.getByRole('radio', { name: 'Sin categoría' })).toBeChecked();
  await fireEvent.press(screen.getByTestId('cat.none'));
  expect(onClear).toHaveBeenCalledTimes(1);
});

it('uses the field colors of each theme', async () => {
  const props = { label: 'Categoría', options: [...options], value: 'rent', onChange: () => {} };
  await render(<Dropdown {...props} testID="cat" />);
  expect(screen.getByTestId('cat')).toHaveStyle({ backgroundColor: lightColors.surfaceBlueSoft });
  await render(
    <ThemeProvider initialPreference="dark" store={noStore}>
      <Dropdown {...props} testID="cat" />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('cat')).toHaveStyle({ backgroundColor: darkColors.surfaceBlueSoft });
  expect(screen.getByText('Arriendo')).toHaveStyle({ color: darkColors.textPrimary });
});

describe('category icons', () => {
  it('has an icon for every category', () => {
    for (const id of CATEGORY_IDS) expect(CATEGORY_ICONS[id]).toBeTruthy();
  });

  it('builds the options with the Spanish label and the icon, in the given order', () => {
    expect(categoryOptions(['transport', 'rent'])).toEqual([
      { value: 'transport', label: 'Transporte', icon: 'bus' },
      { value: 'rent', label: 'Arriendo', icon: 'home' },
    ]);
    expect(categoryOptions()).toHaveLength(CATEGORY_IDS.length);
  });
});
