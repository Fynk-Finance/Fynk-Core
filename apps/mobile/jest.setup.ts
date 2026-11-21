// Native module mocks for Jest. Reanimated runs through its own resolver (jest.config.js).
import 'react-native-gesture-handler/jestSetup';

// Gesture Handler 3 binds its gestures to the Worklets UI runtime, which Jest runs as web and
// cannot provide. Tests do not run native gestures, so the binding is a no-op here.
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () => ({
    installUIRuntimeBindings: () => undefined,
  }),
);

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
