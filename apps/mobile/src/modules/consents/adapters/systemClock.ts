import type { Clock } from '@shared/domain/types';

/** The device clock. Domain code receives a Clock. */
export const systemClock: Clock = { now: () => new Date() };
