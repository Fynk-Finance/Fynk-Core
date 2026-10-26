import { render, screen } from '@testing-library/react-native';

import { FynkLogo } from './FynkLogo';
import { Icon } from './Icon';
import { icons, type IconName } from './paths';

describe('icons', () => {
  it.each(Object.keys(icons) as IconName[])('draws %s', async (name) => {
    await render(<Icon name={name} />);
    expect(screen.toJSON()).not.toBeNull();
  });

  it('paints currentColor shapes with the icon color', async () => {
    await render(<Icon name="tabDashboardActive" color="#123456" />);
    const json = JSON.stringify(screen.toJSON());
    expect(json).not.toContain('currentColor');
    expect(json).toContain('#123456');
  });

  it('is hidden from screen readers unless it has a label', async () => {
    await render(
      <>
        <Icon name="bell" />
        <Icon name="eye" accessibilityLabel="Mostrar contraseña" />
      </>,
    );
    expect(screen.getByLabelText('Mostrar contraseña')).toBeTruthy();
    expect(screen.queryAllByLabelText(/./)).toHaveLength(1);
  });

  it('reads the logo as "Fynk"', async () => {
    await render(<FynkLogo />);
    expect(screen.getByRole('image', { name: 'Fynk' })).toBeTruthy();
  });
});
