// Page parts of the Consentimientos screens, taken from the settings screens of the design
// (CfgPrivacidad.html, the same layout as M1's Seguridad): the 56 px tile on the left, the 48 px
// back button on the right, the title and subtitle, and the 12 px uppercase section labels.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Icon,
  fonts,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

export interface PageHeaderProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  /** Extra content under the subtitle, e.g. the status chip of the detail. */
  children?: ReactNode;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: PageHeaderProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.top}>
        <View style={styles.tile}>
          <Icon name={icon} size={24} color={colors.primaryDark} />
        </View>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          testID="consents.back"
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
        </Pressable>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

export function SectionLabel({ title, meta }: { title: string; meta?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.label}>
      <AppText
        variant="caption"
        color="textSecondary"
        accessibilityRole="header"
        style={styles.labelText}
      >
        {title}
      </AppText>
      {meta ? (
        <AppText variant="captionStrong" color="textSecondary">
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    tile: {
      width: 56,
      height: 56,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    back: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.input,
      backgroundColor: colors.surfaceBlueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20 },
    // h2 of CfgPrivacidad.html: 12/16, bold, .06em, uppercase, secondary text.
    label: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    labelText: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
  });
