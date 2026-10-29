// Buttons of the design:
//   PrimaryButton: blue, 56 px, white bold text, optional arrow ("Ingresar", "Continuar");
//   AccentButton: lime, 56 px, lime shadow ("Empezar");
//   GhostButton: white with grey border, 52 px ("Ahora no"), danger tone ("Eliminar cuenta"),
//   or 56 px with dark text ("Huella o Face ID").
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '../icons';
import { useTheme } from '../theme';
import { fonts, radius, size } from '../tokens';

interface BaseProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Icon before the label. */
  icon?: IconName;
  /** Arrow after the label, as in "Continuar →". */
  withArrow?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityHint?: string;
}

interface Look {
  height: number;
  background: string;
  pressedBackground: string;
  borderColor?: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  arrowStroke: number;
  shadow?: ViewStyle;
}

function BaseButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  withArrow = false,
  style,
  testID,
  accessibilityHint,
  look,
}: BaseProps & { look: Look }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          height: look.height,
          backgroundColor: pressed && !inactive ? look.pressedBackground : look.background,
        },
        look.borderColor ? { borderWidth: 1.5, borderColor: look.borderColor } : null,
        look.shadow,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={18} color={look.textColor} strokeWidth={2.2} /> : null}
          <Text
            style={{ color: look.textColor, fontFamily: look.fontFamily, fontSize: look.fontSize }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {withArrow ? (
            <Icon
              name="arrowRight"
              size={20}
              color={look.textColor}
              strokeWidth={look.arrowStroke}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export type PrimaryButtonProps = BaseProps;

export function PrimaryButton(props: PrimaryButtonProps) {
  const { colors } = useTheme();
  return (
    <BaseButton
      {...props}
      look={{
        height: size.buttonPrimary,
        background: colors.primary,
        pressedBackground: colors.primaryPressed,
        textColor: colors.onPrimary,
        fontFamily: fonts.body.bold,
        fontSize: 16,
        arrowStroke: 2.4,
      }}
    />
  );
}

export type AccentButtonProps = BaseProps;

export function AccentButton(props: AccentButtonProps) {
  const { colors, shadow } = useTheme();
  return (
    <BaseButton
      {...props}
      look={{
        height: size.buttonPrimary,
        background: colors.accent,
        pressedBackground: colors.accentPressed,
        textColor: colors.onPrimary,
        fontFamily: fonts.body.semibold,
        fontSize: 16,
        arrowStroke: 2.2,
        shadow: shadow.accentButton,
      }}
    />
  );
}

export interface GhostButtonProps extends BaseProps {
  tone?: 'default' | 'neutral' | 'danger';
  size?: 'md' | 'lg';
}

export function GhostButton({ tone = 'default', size: s = 'md', ...props }: GhostButtonProps) {
  const { colors } = useTheme();
  const danger = tone === 'danger';
  return (
    <BaseButton
      {...props}
      look={{
        height: s === 'lg' ? size.buttonPrimary : size.buttonSecondary,
        background: danger ? colors.dangerSurface : colors.background,
        pressedBackground: danger ? colors.dangerSoft : colors.surfaceBlueSoft,
        borderColor: danger ? colors.dangerBorder : colors.border,
        textColor: danger
          ? colors.danger
          : tone === 'neutral'
            ? colors.textPrimary
            : colors.textSecondary,
        fontFamily: fonts.body.bold,
        fontSize: 15,
        arrowStroke: 2.4,
      }}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabled: { opacity: 0.5 },
});
