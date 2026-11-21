import type { Clock } from '@shared/domain/types';

/** The device clock, for the session service's refresh timing. Domain code receives a Clock. */
export const systemClock: Clock = { now: () => new Date() };
