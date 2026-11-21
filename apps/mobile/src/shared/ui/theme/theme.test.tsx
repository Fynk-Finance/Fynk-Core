// Theme default and override (shared contracts 3.6): follow the phone, unless the person picked
// Claro or Oscuro; the choice is saved and loaded on the next start.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Appearance, Pressable, Text, useColorScheme } from 'react-native';

import { THEME_PREFERENCE_KEY, asyncStorageThemeStore } from './preferenceStore';
import { isThemePreference, resolveScheme, type ThemePreference } from './scheme';
import {
  ThemeProvider,
  useTheme,
  useThemePreference,
  useThemedStyles,
  type Theme,
} from './ThemeProvider';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const phoneScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function memoryStore(saved: ThemePreference) {
  let value = saved;
  return {
    load: jest.fn(async () => value),
    save: jest.fn(async (next: ThemePreference) => {
      value = next;
    }),
  };
}

function Probe() {
  const { scheme, colors } = useTheme();
  const [preference, setPreference] = useThemePreference();
  return (
    <>
      <Text testID="scheme">{scheme}</Text>
      <Text testID="background">{colors.background}</Text>
      <Text testID="preference">{preference}</Text>
      <Pressable testID="pick-dark" onPress={() => setPreference('dark')} />
      <Pressable testID="pick-system" onPress={() => setPreference('system')} />
    </>
  );
}

const flush = () => act(async () => {});

describe('resolveScheme', () => {
  it('follows the phone when the preference is system', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });

  it('starts in light when the phone reports no scheme', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });

  it('uses the chosen scheme over the phone', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('accepts only the three preferences', () => {
    expect(['system', 'light', 'dark'].every(isThemePreference)).toBe(true);
    expect(isThemePreference('oscuro')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => phoneScheme.mockReturnValue('light'));

  it('draws in light without a provider', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('scheme')).toHaveTextContent('light');
  });

  it('follows the phone by default', async () => {
    phoneScheme.mockReturnValue('dark');
    await render(
      <ThemeProvider store={memoryStore('system')}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    expect(screen.getByTestId('background')).toHaveTextContent('#13212D');
  });

  it('loads the saved choice', async () => {
    await render(
      <ThemeProvider store={memoryStore('dark')}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();
    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
  });

  it('applies a new choice at once, saves it and tells the native side', async () => {
    const setNative = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    const store = memoryStore('system');
    await render(
      <ThemeProvider store={store}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();

    await fireEvent.press(screen.getByTestId('pick-dark'));
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    expect(store.save).toHaveBeenLastCalledWith('dark');
    expect(setNative).toHaveBeenLastCalledWith('dark');

    await fireEvent.press(screen.getByTestId('pick-system'));
    expect(screen.getByTestId('scheme')).toHaveTextContent('light');
    expect(setNative).toHaveBeenLastCalledWith('unspecified');
    setNative.mockRestore();
  });

  it('builds themed styles once per scheme', async () => {
    const factory = jest.fn(({ colors }: Theme) => ({ color: colors.textPrimary }));
    function Styled({ testID }: { testID: string }) {
      return <Text testID={testID}>{useThemedStyles(factory).color}</Text>;
    }
    await render(
      <>
        <ThemeProvider initialPreference="light" store={memoryStore('light')}>
          <Styled testID="light-a" />
          <Styled testID="light-b" />
        </ThemeProvider>
        <ThemeProvider initialPreference="dark" store={memoryStore('dark')}>
          <Styled testID="dark-a" />
          <Styled testID="dark-b" />
        </ThemeProvider>
      </>,
    );
    expect(screen.getByTestId('light-b')).toHaveTextContent('#0F2233');
    expect(screen.getByTestId('dark-b')).toHaveTextContent('#E8F1F6');
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('asyncStorageThemeStore', () => {
  beforeEach(() => AsyncStorage.clear());

  it('saves and loads the choice under ui.themePreference', async () => {
    await asyncStorageThemeStore.save('light');
    expect(await AsyncStorage.getItem(THEME_PREFERENCE_KEY)).toBe('light');
    expect(await asyncStorageThemeStore.load()).toBe('light');
  });

  it('falls back to system for a missing or unknown value', async () => {
    expect(await asyncStorageThemeStore.load()).toBe('system');
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, 'sepia');
    expect(await asyncStorageThemeStore.load()).toBe('system');
  });
});
