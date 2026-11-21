// Cards of the design:
//   outlined: white, 1 px light blue border, soft shadow (Billetera rows, Inversión stats);
//   soft: light blue surface without shadow (Recomendaciones donut, Inversión distribution);
//   primary: light blue card with decorative squares and the moving shine (Billetera opportunity).
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useThemedStyles, type Theme } from '../theme';
import { radius } from '../tokens';
import { Shine } from './Shine';

export interface CardProps {
  children: ReactNode;
  variant?: 'outlined' | 'soft' | 'primary';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Card({
  children,
  variant = 'outlined',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: CardProps) {
  const styles = useThemedStyles(createStyles);
  const [box, setBox] = useState({ width: 350, height: 96 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  const body = (
    <>
      {variant === 'primary' ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={box.width} height={box.height}>
            <Rect
              x={box.width - 114}
              y={-58}
              width={120}
              height={120}
              rx={30}
              fill={styles.shapes.light}
            />
            <Rect
              x={box.width - 66}
              y={-22}
              width={64}
              height={64}
              rx={16}
              fill={styles.shapes.lighter}
            />
            <Rect
              x={-30}
              y={box.height - 34}
              width={80}
              height={80}
              rx={20}
              fill={styles.shapes.corner}
            />
          </Svg>
          <Shine distance={box.width + 170} height={box.height + 80} width={40} />
        </View>
      ) : null}
      {children}
    </>
  );

  const cardStyle = [styles.base, styles[variant], style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onLayout={onLayout}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View
      onLayout={onLayout}
      style={cardStyle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {body}
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) => ({
  ...StyleSheet.create({
    base: { overflow: 'hidden' },
    outlined: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      padding: 14,
      ...shadow.card,
    },
    soft: {
      backgroundColor: colors.surfaceBlueSoft,
      borderRadius: radius.sheetSm,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      padding: 16,
    },
    primary: {
      backgroundColor: colors.primaryLight,
      borderRadius: radius.card,
      padding: 14,
    },
    pressed: { transform: [{ translateY: 1 }], opacity: 0.95 },
  }),
  shapes: {
    light: colors.cardShapeLight,
    lighter: colors.cardShapeLighter,
    corner: colors.headerShapeB,
  },
});
