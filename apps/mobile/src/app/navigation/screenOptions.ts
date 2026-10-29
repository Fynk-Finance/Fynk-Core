// Default transition and back gesture of every screen (shared contracts 3.6, docs/design/README.md
// "Navigation and gestures"). A screen changes them only through `transition` and `gesture` in
// its ModuleScreen, when its inventory row says so. Pure, so the rules are tested on their own.
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import type { BackGesture, ScreenTransition } from '@shared/navigation';
import { radius } from '@shared/ui';

export interface MotionSettings {
  /** The phone's Reduce Motion setting: every animation becomes a fade. */
  reduceMotion: boolean;
}

const BY_TRANSITION: Record<ScreenTransition, NativeStackNavigationOptions> = {
  // Slides in from the right like iOS on both platforms. Back: the button, the swipe from
  // anywhere on the screen (iOS) or the system back gesture (Android, predictive back).
  push: { animation: 'ios_from_right', gestureEnabled: true, fullScreenGestureEnabled: true },
  // Slides up from the bottom and closes with a swipe down (Detalle de cuenta, Omitir).
  modal: {
    animation: 'slide_from_bottom',
    gestureEnabled: true,
    gestureDirection: 'vertical',
    fullScreenGestureEnabled: true,
    animationMatchesGesture: true,
  },
  // A native bottom sheet sized to its content, closed by dragging it down.
  sheet: {
    presentation: 'formSheet',
    sheetAllowedDetents: 'fitToContents',
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    gestureEnabled: true,
  },
  // Flow changes (sign in, unlock, end of onboarding): no gesture back.
  fade: { animation: 'fade', gestureEnabled: false },
  none: { animation: 'none', gestureEnabled: false },
};

const BY_GESTURE: Record<Exclude<BackGesture, 'default'>, NativeStackNavigationOptions> = {
  vertical: {
    gestureEnabled: true,
    gestureDirection: 'vertical',
    fullScreenGestureEnabled: true,
    animationMatchesGesture: true,
  },
  off: { gestureEnabled: false },
};

export function screenOptionsFor(
  {
    transition = 'push',
    gesture = 'default',
  }: { transition?: ScreenTransition; gesture?: BackGesture },
  { reduceMotion }: MotionSettings,
): NativeStackNavigationOptions {
  const options: NativeStackNavigationOptions = {
    ...BY_TRANSITION[transition],
    ...(gesture === 'default' ? null : BY_GESTURE[gesture]),
  };
  if (reduceMotion && options.animation !== 'none' && options.presentation !== 'formSheet') {
    options.animation = 'fade';
    options.animationMatchesGesture = false;
  }
  return options;
}

/** The full-screen flows and the tabs replace each other with a fade, never a gesture back. */
export const flowOptions = screenOptionsFor({ transition: 'fade' }, { reduceMotion: false });
