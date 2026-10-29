// "Autorizo a Fynk a consultar y tratar estos datos según la Política de privacidad."
// (ConectarBanco.html). Unchecked by default; the host keeps the state. There is no shared
// checkbox, so it is built here from tokens: a 24/7 box with a 2 px ring, filled with the primary
// blue when checked (the checked look comes from ConectarBanco-37ko.html, accent-color #2fa8d8).
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, fonts, useThemedStyles, type Theme } from '@shared/ui';

import { consentsStrings } from './strings.es-CO';

const t = consentsStrings.checkbox;

export interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Opens the privacy policy (M13). Without it the words are shown without a link. */
  onPressPolicy?: () => void;
  disabled?: boolean;
}

export function ConsentCheckbox({
  checked,
  onChange,
  onPressPolicy,
  disabled = false,
}: ConsentCheckboxProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={t.label}
      accessibilityState={{ checked, disabled }}
      hitSlop={8}
      style={styles.row}
      testID="consents.checkbox"
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]} testID="consents.checkbox.box">
        {checked ? (
          <Icon name="check" size={16} color={styles.check.color} strokeWidth={3} />
        ) : null}
      </View>
      <AppText variant="small" style={styles.text}>
        {t.before}
        <AppText
          variant="smallStrong"
          color="primaryDeep"
          onPress={onPressPolicy}
          disabled={!onPressPolicy}
          accessibilityRole={onPressPolicy ? 'link' : undefined}
          accessibilityHint={onPressPolicy ? t.policyHint : undefined}
          style={styles.policy}
        >
          {t.policy}
        </AppText>
        {t.after}
      </AppText>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) => ({
  ...StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    box: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.controlBorder,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
    text: { flex: 1, lineHeight: 19 },
    policy: { fontFamily: fonts.body.bold, lineHeight: 19 },
  }),
  check: { color: colors.onPrimary },
});
