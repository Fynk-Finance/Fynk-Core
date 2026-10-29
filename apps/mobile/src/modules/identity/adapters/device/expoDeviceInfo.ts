// DeviceInfoPort: the model name and the platform of this phone.
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { DeviceInfoPort } from '../../application/ports';
import { deviceDisplayName } from '../../domain/device';

export function createExpoDeviceInfo(): DeviceInfoPort {
  return {
    get() {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      return { platform, name: deviceDisplayName(Device.modelName, platform) };
    },
  };
}
