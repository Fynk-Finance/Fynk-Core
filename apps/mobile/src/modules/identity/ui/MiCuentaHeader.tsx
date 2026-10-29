// Header of Mi cuenta (DetalleCuentas): blue area with its decorative squares and moving shine,
// the back button, the title, the 88 px avatar with its ring, the full name and the
// "Perfil verificado" pill. Other modules never rebuild it; they import it from the identity index.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import {
  AppText,
  BackButton,
  Badge,
  Icon,
  Shine,
  fonts,
  radius,
  size,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { displayNameOf, initialsOf } from '../domain/profile';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.miCuenta;

export interface MiCuentaHeaderProps {
  /** Without a profile (while it loads or failed) only the back button and the title show. */
  profile?: { firstName?: string; lastName?: string; emailVerified: boolean };
  onBack: () => void;
}

export function MiCuentaHeader({ profile, onBack }: MiCuentaHeaderProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const name = profile ? displayNameOf(profile.firstName, profile.lastName) : '';
  const initials = profile ? initialsOf(profile.firstName, profile.lastName) : '';

  return (
    <View style={styles.shadow}>
      <View style={[styles.blue, { paddingTop: insets.top + 16 }]}>
        <Svg width={390} height={257} viewBox="0 0 390 257" style={StyleSheet.absoluteFill}>
          <Rect x={268} y={-70} width={190} height={190} rx={44} fill={colors.headerShapeA} />
          <Rect x={320} y={-26} width={96} height={96} rx={24} fill={colors.headerShapeB} />
          <Rect x={-56} y={150} width={140} height={140} rx={34} fill={colors.primaryPressed} />
        </Svg>
        <Shine distance={520} height={340} width={46} opacity={0.12} />
        <View style={styles.top}>
          <BackButton onPress={onBack} />
          <AppText
            variant="headerTitle"
            color="onPrimary"
            accessibilityRole="header"
            style={styles.title}
          >
            {t.title}
          </AppText>
          <View style={styles.balance} />
        </View>
        {profile ? (
          <View style={styles.person}>
            <View style={styles.ring} testID="identity.miCuenta.avatar">
              <View style={styles.circle}>
                {initials ? (
                  <Text style={styles.initials}>{initials}</Text>
                ) : (
                  // No name: a generic avatar. Never initials from the masked email.
                  <Icon name="user" size={40} color={colors.primary} />
                )}
              </View>
            </View>
            <AppText variant="section" color="onPrimary" numberOfLines={1} style={styles.name}>
              {name || t.fallbackName}
            </AppText>
            {profile.emailVerified ? (
              <View accessible accessibilityLabel={t.verifiedHint}>
                <Badge tone="accent" size="lg" icon="check" label={t.verified} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    shadow: { ...shadow.header, zIndex: 1 },
    blue: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      paddingHorizontal: spacing.screen - 4,
      paddingBottom: spacing.screen,
      gap: spacing.md,
      overflow: 'hidden',
    },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { flex: 1, textAlign: 'center' },
    // Same width as the back button, so the title stays centered.
    balance: { width: size.backButton },
    person: { alignItems: 'center', gap: spacing.md },
    // box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.28) of the design.
    ring: { padding: 4, borderRadius: radius.pill, backgroundColor: colors.onPrimaryBadge },
    circle: {
      width: 88,
      height: 88,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontFamily: fonts.heading.bold, fontSize: 32, color: colors.primary },
    name: { lineHeight: 24 },
  });
