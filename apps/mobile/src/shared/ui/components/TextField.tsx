// Text field of Login and OnbNombre: label above, 56 px light blue field with an icon
// on the left, blue border and white background on focus, eye toggle for passwords.
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, radius, size } from '../tokens';
import { AppText } from './AppText';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  icon?: IconName;
  /** Text before the value, like the `$` of the money fields in OnbCuentas, OnbGastos, OnbMetas. */
  prefix?: string;
  /** Password field: hidden text plus the "Mostrar contraseña" eye toggle. */
  secure?: boolean;
  error?: string;
  helper?: string;
}

export function TextField({
  label,
  icon,
  prefix,
  secure = false,
  error,
  helper,
  onFocus,
  onBlur,
  testID,
  ...input
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.wrapper}>
      <AppText variant="label" nativeID={testID ? `${testID}-label` : undefined}>
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          secure ? styles.fieldWithEye : null,
          focused ? styles.focused : null,
          hasError ? styles.error : null,
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={colors.primaryDark} /> : null}
        {prefix ? (
          <AppText style={styles.prefix} importantForAccessibility="no" accessibilityElementsHidden>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          {...input}
          testID={testID}
          accessibilityLabel={label}
          secureTextEntry={secure && !visible}
          placeholderTextColor={colors.textPlaceholder}
          selectionColor={colors.primary}
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? uiStrings.hidePassword : uiStrings.showPassword}
            accessibilityState={{ selected: visible }}
            style={({ pressed }) => [styles.eye, pressed ? styles.eyePressed : null]}
            testID={testID ? `${testID}-eye` : undefined}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={20} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="textSecondary">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrapper: { gap: 8 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: size.input,
      paddingHorizontal: 16,
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    fieldWithEye: { paddingRight: 8 },
    prefix: {
      fontFamily: fonts.amount.semibold,
      fontSize: 15,
      color: colors.textSecondary,
    },
    focused: { borderColor: colors.primary, backgroundColor: colors.background },
    error: { borderColor: colors.danger },
    input: {
      flex: 1,
      height: '100%',
      fontFamily: fonts.body.regular,
      fontSize: 15,
      color: colors.textPrimary,
      padding: 0,
    },
    eye: {
      width: 40,
      height: 40,
      borderRadius: radius.tileSm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyePressed: { backgroundColor: colors.surfaceBlue },
  });
