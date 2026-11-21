// The app version kept as consent evidence. Read from app.json, the version the stores show,
// because the app has no shared app-info source yet (asked of M0 in the pull request).
import { randomUUID } from 'expo-crypto';

import appConfig from '../../../../app.json';

export const appVersion: string = appConfig.expo.version;

export const newIdempotencyKey = (): string => randomUUID();
