import { Platform } from 'react-native';

import { createExpoDeviceInfo } from './expoDeviceInfo';

const mockDevice: { modelName: string | null } = { modelName: 'Pixel 8' };
jest.mock('expo-device', () => ({
  get modelName() {
    return mockDevice.modelName;
  },
}));

it('reads the model and platform', () => {
  Platform.OS = 'android';
  expect(createExpoDeviceInfo().get()).toEqual({ platform: 'android', name: 'Pixel 8' });
});

it('falls back when the model is unknown', () => {
  Platform.OS = 'ios';
  mockDevice.modelName = null;
  expect(createExpoDeviceInfo().get()).toEqual({ platform: 'ios', name: 'iPhone' });
});
