// Default transitions and gestures (shared contracts 3.6) and their overrides.
import { flowOptions, screenOptionsFor } from './screenOptions';

const motion = { reduceMotion: false };

describe('screenOptionsFor', () => {
  it('pushes from the right with the edge swipe by default', () => {
    expect(screenOptionsFor({}, motion)).toEqual({
      animation: 'ios_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    });
  });

  it('slides a modal up and closes it with a swipe down', () => {
    expect(screenOptionsFor({ transition: 'modal' }, motion)).toMatchObject({
      animation: 'slide_from_bottom',
      gestureEnabled: true,
      gestureDirection: 'vertical',
    });
  });

  it('shows a sheet as a native bottom sheet sized to its content', () => {
    expect(screenOptionsFor({ transition: 'sheet' }, motion)).toMatchObject({
      presentation: 'formSheet',
      sheetAllowedDetents: 'fitToContents',
      sheetCornerRadius: 32,
      gestureEnabled: true,
    });
  });

  it('turns the gesture off when the spec says so, keeping the animation', () => {
    expect(screenOptionsFor({ gesture: 'off' }, motion)).toEqual({
      animation: 'ios_from_right',
      gestureEnabled: false,
      fullScreenGestureEnabled: true,
    });
  });

  it('can close a pushed screen with a swipe down', () => {
    expect(screenOptionsFor({ gesture: 'vertical' }, motion)).toMatchObject({
      animation: 'ios_from_right',
      gestureDirection: 'vertical',
    });
  });

  it('fades every animation when Reduce Motion is on', () => {
    const reduced = { reduceMotion: true };
    expect(screenOptionsFor({}, reduced).animation).toBe('fade');
    expect(screenOptionsFor({ transition: 'modal' }, reduced)).toMatchObject({
      animation: 'fade',
      animationMatchesGesture: false,
      gestureEnabled: true,
    });
    expect(screenOptionsFor({ transition: 'none' }, reduced).animation).toBe('none');
  });

  it('keeps the gestures when Reduce Motion is on', () => {
    expect(screenOptionsFor({}, { reduceMotion: true }).gestureEnabled).toBe(true);
  });

  it('changes flows with a fade and no gesture back', () => {
    expect(flowOptions).toEqual({ animation: 'fade', gestureEnabled: false });
  });
});
