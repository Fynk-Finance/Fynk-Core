// The Fynk dialog, in place of the Android Alert.alert (QA review 2026-11-07, V8). The design has
// no dialog, so it is built from its pieces: the page color card (white, dark in dark mode) with
// the card shadow, the 16 px heading of the cards, body text and the design's buttons, over the
// scrim of the Dashboard + menu. New component, needs design review.
//
// `dialog.show()` takes the arguments of `Alert.alert`, so callers swap one for the other and
// tests spy on `dialog.show` as they spied on `Alert.alert`. One <DialogHost /> in the app root
// draws the dialogs, one at a time, in the order they were asked for.
import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';

import { uiStrings } from '../strings.es-CO';
import { useThemedStyles, type Theme } from '../theme';
import { motion, radius, spacing } from '../tokens';
import { AppText } from './AppText';
import { GhostButton, PrimaryButton } from './Button';

export interface DialogButton {
  text?: string;
  /** "cancel" goes last and also runs when the dialog is closed from outside. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  /** Lets a choice without a cancel button close from outside (scrim, back button). */
  cancelable?: boolean;
  /** Runs when it closes from outside and there is no cancel button. */
  onDismiss?: () => void;
}

interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  options?: DialogOptions;
}

// The dialogs waiting to be seen, the first one on screen. Kept outside React so dialog.show()
// works from anywhere, even before the host mounts.
let queue: readonly DialogRequest[] = [];
let lastId = 0;
const listeners = new Set<() => void>();
const setQueue = (next: readonly DialogRequest[]) => {
  queue = next;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const firstInQueue = () => queue[0];

export const dialog = {
  /** Same arguments as Alert.alert. Without buttons it offers "Entendido". */
  show(title: string, message?: string, buttons?: DialogButton[], options?: DialogOptions): void {
    const request: DialogRequest = {
      id: ++lastId,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: uiStrings.dialogOk }],
      options,
    };
    setQueue([...queue, request]);
  },
};

/** Whether the scrim and the back button close it: a cancel, a single button or `cancelable`. */
function closesFromOutside({ buttons, options }: DialogRequest): boolean {
  return buttons.some((b) => b.style === 'cancel') || buttons.length === 1 || !!options?.cancelable;
}

const pop = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(0.34, 1.56, 0.64, 1) },
}).duration(motion.slow);

export interface DialogCardProps {
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** Called with the pressed button. */
  onPress: (button: DialogButton) => void;
}

/** The card alone, without the scrim or the queue: the host draws it, the catalog shows it. */
export function DialogCard({ title, message, buttons, onPress }: DialogCardProps) {
  const styles = useThemedStyles(createStyles);
  // The actions in the given order, the cancel button below them.
  const ordered = [
    ...buttons.filter((b) => b.style !== 'cancel'),
    ...buttons.filter((b) => b.style === 'cancel'),
  ];
  return (
    <View style={styles.card} accessibilityViewIsModal testID="dialog.card">
      <View style={styles.text}>
        <AppText variant="cardTitle" accessibilityRole="header">
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" color="textSecondary">
            {message}
          </AppText>
        ) : null}
      </View>
      <View style={styles.buttons}>
        {ordered.map((button, i) => {
          const label = button.text ?? uiStrings.dialogOk;
          const press = () => onPress(button);
          if (button.style === 'destructive')
            return <GhostButton key={i} label={label} tone="danger" onPress={press} />;
          if (button.style === 'cancel')
            return <GhostButton key={i} label={label} tone="neutral" onPress={press} />;
          return <PrimaryButton key={i} label={label} onPress={press} />;
        })}
      </View>
    </View>
  );
}

/** Draws the dialogs asked for with `dialog.show()`. Mount it once, inside the ThemeProvider. */
export function DialogHost() {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const current = useSyncExternalStore(subscribe, firstInQueue);
  if (!current) return null;

  const close = (run?: () => void) => {
    setQueue(queue.slice(1));
    run?.();
  };
  const outside = closesFromOutside(current);
  const dismiss = () => {
    if (!outside) return;
    const cancel = current.buttons.find((b) => b.style === 'cancel');
    close(cancel ? cancel.onPress : current.options?.onDismiss);
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
          style={StyleSheet.absoluteFill}
        >
          {outside ? (
            <Pressable
              onPress={dismiss}
              accessibilityRole="button"
              accessibilityLabel={uiStrings.dialogDismiss}
              style={styles.scrim}
            />
          ) : (
            <View style={styles.scrim} />
          )}
        </Animated.View>
        <Animated.View
          key={current.id}
          entering={reduceMotion ? undefined : pop}
          style={styles.center}
          pointerEvents="box-none"
        >
          <DialogCard
            title={current.title}
            message={current.message}
            buttons={current.buttons}
            onPress={(button) => close(button.onPress)}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    // The ink color at 40 %, like the Dashboard + menu.
    scrim: { flex: 1, backgroundColor: colors.shadow, opacity: 0.4 },
    center: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.screen,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      padding: 24,
      gap: spacing.block,
      borderRadius: radius.cardLg,
      backgroundColor: colors.background,
      ...shadow.card,
    },
    text: { gap: spacing.md },
    buttons: { gap: spacing.lg },
  });
