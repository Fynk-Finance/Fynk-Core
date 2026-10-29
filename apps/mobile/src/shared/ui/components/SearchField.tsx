// Search box of Movimientos ("Buscar por nombre", `.field`): 48 px high, radius 16, light blue
// border and surface, a 16 px search icon, and the focused look of the text field (blue border,
// page color). It has no visible label, so the placeholder is also its accessibility label.
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '../icons';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, radius, size } from '../tokens';

export interface SearchFieldProps extends Omit<
  TextInputProps,
  'style' | 'placeholder' | 'accessibilityLabel'
> {
  placeholder: string;
}

export function SearchField({ placeholder, onFocus, onBlur, ...input }: SearchFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused ? styles.focused : null]}>
      <Icon name="search" size={16} color={colors.primaryDark} />
      <TextInput
        {...input}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        selectionColor={colors.primary}
        returnKeyType="search"
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
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: size.searchField,
      paddingHorizontal: 16,
      borderRadius: radius.button,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    focused: { borderColor: colors.primary, backgroundColor: colors.background },
    input: {
      flex: 1,
      height: '100%',
      fontFamily: fonts.body.regular,
      fontSize: 15,
      color: colors.textPrimary,
      padding: 0,
    },
  });
