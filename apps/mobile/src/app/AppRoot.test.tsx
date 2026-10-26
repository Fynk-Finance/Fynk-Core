import { render, screen } from '@testing-library/react-native';

import { AppRoot } from './AppRoot';

describe('AppRoot', () => {
  it('renders the placeholder root', async () => {
    await render(<AppRoot />);
    expect(screen.getByTestId('app-root')).toBeTruthy();
  });
});
