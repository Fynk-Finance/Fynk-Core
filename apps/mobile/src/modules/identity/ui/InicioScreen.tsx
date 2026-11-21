// Inicio (VerdeInicio.dc.html): the first screen of a signed out user. "Empezar" opens
// Keycloak's registration and "Ya tengo cuenta" its sign in, both in the system browser.
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccentButton, AppText, useTheme } from '@shared/ui';

import type { SessionState } from '../application/sessionService';
import { InicioIllustration } from './InicioIllustration';
import { Rise } from './Rise';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.inicio;

// Layout of VerdeInicio: padding 48 / 24 / 40 and 32 between blocks.
const PAD_TOP = 48;
const PAD_SIDE = 24;
const PAD_BOTTOM = 40;
const GAP = 32;

export interface InicioScreenProps {
  state: SessionState;
  onStart: () => void;
  onSignIn: () => void;
}

export function InicioScreen({ state, onStart, onSignIn }: InicioScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      testID="identity.inicio"
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + PAD_TOP,
          paddingBottom: insets.bottom + PAD_BOTTOM,
        },
      ]}
    >
      <View style={styles.art}>
        <InicioIllustration />
      </View>

      <View style={styles.copy}>
        <Rise delay={150}>
          <AppText variant="display" align="center" accessibilityRole="header">
            {t.titleStart}
            {'\n'}
            <AppText variant="display" color="primaryLight">
              {t.titleHighlight}
            </AppText>
          </AppText>
        </Rise>
        <Rise delay={300} style={styles.subtitle}>
          <AppText variant="body" color="textSecondary" align="center">
            {t.subtitle}
          </AppText>
        </Rise>
      </View>

      <Rise delay={450} style={styles.actions}>
        <AccentButton
          label={t.start}
          withArrow
          loading={state.busy}
          onPress={onStart}
          accessibilityHint={t.startHint}
          testID="identity.inicio.start"
        />
        <Pressable
          onPress={onSignIn}
          disabled={state.busy}
          accessibilityRole="button"
          accessibilityHint={t.signInHint}
          accessibilityState={{ disabled: state.busy }}
          hitSlop={8}
          testID="identity.inicio.signIn"
        >
          <AppText variant="label" color="link" align="center">
            {t.signIn}
          </AppText>
        </Pressable>
        {state.error ? (
          <AppText
            variant="small"
            color="danger"
            align="center"
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            testID="identity.inicio.error"
          >
            {t.errors[state.error]}
          </AppText>
        ) : null}
      </Rise>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: PAD_SIDE, gap: GAP },
  // The design lets the illustration bleed to the screen edges.
  art: { flex: 1, marginHorizontal: -PAD_SIDE, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 12, alignItems: 'center' },
  subtitle: { maxWidth: 300 },
  actions: { alignSelf: 'stretch', gap: 16 },
});
