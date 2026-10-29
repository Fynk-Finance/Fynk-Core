export { createPlaceholderScreen, type PlaceholderOptions } from './PlaceholderScreen';
export { Slot, registerSlot, type SlotName } from './slots';

/** Mi cuenta › Apariencia, a screen of the app shell (M0). M1 opens it from the "Apariencia" row. */
export const APPEARANCE_ROUTE = 'app.Appearance';
export type { BackGesture, ModuleRoutes, ModuleScreen, ScreenTransition, TabName } from './types';
/**
 * Default transition and back gesture of each kind of screen. Shared so a module's own nested
 * stack (the onboarding flow) moves exactly like the root stack.
 */
export { flowOptions, screenOptionsFor, type MotionSettings } from './screenOptions';
