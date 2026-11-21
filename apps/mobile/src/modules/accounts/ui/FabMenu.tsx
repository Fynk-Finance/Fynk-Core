// The menu of the Dashboard + (QA review 2026-11-07, F5): a scrim and two actions above the FAB,
// "Ingreso" and "Gasto", each opening M7's sheet on that type. The design keeps only its CSS
// (`.fb-scrim` .2s ease-out, `.fb-act` pop .25s cubic-bezier(.34,1.56,.64,1) from 12 px lower at
// 90 %), so the look is new: needs design review. It closes from the scrim, the FAB, the system
// back button or an action. The screen renders the FAB after it, so the FAB stays on top.
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';

import {
  Icon,
  fonts,
  motion,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.dashboard.fabMenu;

export type MovementKind = 'income' | 'expense';

/** The FAB's offset from the page's bottom edge; the actions start 12 px above it. */
export const FAB_BOTTOM = 12;

const pop = (index: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 12 }, { scale: 0.9 }] },
    100: {
      opacity: 1,
      transform: [{ translateY: 0 }, { scale: 1 }],
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    },
  })
    .duration(motion.slow)
    .delay(index * 40);

const ACTIONS: { kind: MovementKind; label: string; a11y: string; icon: IconName }[] = [
  { kind: 'income', label: t.income, a11y: t.incomeLabel, icon: 'arrowUpRight' },
  { kind: 'expense', label: t.expense, a11y: t.expenseLabel, icon: 'arrowDownLeft' },
];

export function FabMenu({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (kind: MovementKind) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={StyleSheet.absoluteFill} testID="accounts.dashboard.fabMenu">
      <Animated.View
        entering={FadeIn.duration(motion.base).easing(Easing.out(Easing.ease))}
        exiting={FadeOut.duration(motion.fast)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.close}
          style={styles.scrim}
        />
      </Animated.View>
      <View style={styles.actions} pointerEvents="box-none">
        {ACTIONS.map((action, index) => (
          <Animated.View
            key={action.kind}
            entering={pop(ACTIONS.length - 1 - index)}
            exiting={FadeOut.duration(motion.fast)}
          >
            <Pressable
              onPress={() => onPick(action.kind)}
              accessibilityRole="button"
              accessibilityLabel={action.a11y}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <View style={styles.pill}>
                <Text style={styles.label}>{action.label}</Text>
              </View>
              <View style={styles.tile}>
                <Icon
                  name={action.icon}
                  size={22}
                  strokeWidth={2.4}
                  color={action.kind === 'income' ? colors.link : colors.primaryDark}
                />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    // The scrim darkens the page with the ink color at 40 %.
    scrim: { flex: 1, backgroundColor: colors.shadow, opacity: 0.4 },
    actions: {
      position: 'absolute',
      right: 16 + (size.fab - 48) / 2,
      bottom: FAB_BOTTOM + size.fab + 12,
      alignItems: 'flex-end',
      gap: 12,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pill: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      justifyContent: 'center',
      ...shadow.card,
    },
    label: { fontFamily: fonts.body.bold, fontSize: 14, color: colors.textPrimary },
    tile: {
      width: 48,
      height: 48,
      borderRadius: radius.button,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.card,
    },
    pressed: { opacity: 0.85 },
  });
