// Lock screen (new screen, needs design review). The header is the one of Login.html: the blue
// background with its rounded squares, the Fynk logo and the title. The lime layer and white
// sheet below hold the unlock buttons: the password and, when enabled, "Huella o Face ID".
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import {
  AppText,
  ErrorState,
  FynkLogo,
  GhostButton,
  PrimaryButton,
  radius,
  useTheme,
} from '@shared/ui';

import type { LockState } from '../application/lockController';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.lock;

export interface LockScreenProps {
  state: LockState;
  onPassword: () => void;
  onBiometric: () => void;
  onRetry: () => void;
}

// Login.html: header padding 48 / 24 and 24 between blocks; sheet padding 32 / 24.
const PAD_TOP = 48;
const PAD_SIDE = 24;
const GAP = 24;
const SHEET_PAD = 32;
// The lime layer shows 14 px above the white sheet (645 against 631 in Login.html).
const LIME_EDGE = 14;

export function LockScreen({ state, onPassword, onBiometric, onRetry }: LockScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]} testID="vault.lock">
      {/* Squares of Login.html. The fifth is the design's skewed shine, which is not drawn. */}
      <Svg width={390} height={844} viewBox="0 0 390 844" style={StyleSheet.absoluteFill}>
        <Rect x={226} y={-86} width={230} height={230} rx={52} fill={colors.headerShapeA} />
        <Rect x={296} y={-30} width={116} height={116} rx={28} fill={colors.headerShapeB} />
        <Rect x={-70} y={196} width={170} height={170} rx={40} fill={colors.primaryPressed} />
        <Rect x={40} y={150} width={58} height={58} rx={16} fill={colors.headerShapeA} />
        <Rect x={300} y={236} width={74} height={74} rx={20} fill={colors.primaryPressed} />
      </Svg>

      <View style={[styles.header, { paddingTop: insets.top + PAD_TOP }]}>
        <FynkLogo />
        <View style={styles.titles}>
          <AppText variant="display" color="onPrimary" accessibilityRole="header">
            {t.title}
          </AppText>
          <AppText variant="body" color="onPrimary">
            {t.subtitle}
          </AppText>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={[styles.lime, { backgroundColor: colors.accent }]}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + SHEET_PAD },
            ]}
          >
            <SheetContent
              state={state}
              onPassword={onPassword}
              onBiometric={onBiometric}
              onRetry={onRetry}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function SheetContent({ state, onPassword, onBiometric, onRetry }: LockScreenProps) {
  const { colors } = useTheme();

  if (state.status === 'unlocking') {
    return (
      <View style={styles.center} testID="vault.lock.unlocking">
        <ActivityIndicator color={colors.primary} accessibilityLabel={t.unlocking} />
      </View>
    );
  }
  if (state.status === 'pendingDevice') {
    return (
      <View style={styles.center} testID="vault.lock.pending">
        <AppText variant="section" align="center">
          {t.pendingTitle}
        </AppText>
        <AppText variant="small" color="textSecondary" align="center">
          {t.pendingMessage}
        </AppText>
      </View>
    );
  }
  if (state.status === 'error') {
    const reason = state.error ?? 'unknown';
    return (
      <ErrorState
        title={t.errorTitle}
        message={t.errors[reason]}
        // An engine without SQLCipher is never retried.
        onRetry={reason === 'notEncrypted' ? undefined : onRetry}
      />
    );
  }
  return (
    <View style={styles.actions}>
      <PrimaryButton
        label={t.password}
        onPress={onPassword}
        accessibilityHint={t.passwordHint}
        testID="vault.lock.password"
      />
      {state.biometric ? (
        <>
          {/* Login.html: a divider "o ingresa con" and the ghost button with the fingerprint. */}
          <View style={styles.divider} accessibilityElementsHidden>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
            <AppText variant="small" color="textPlaceholder">
              {t.orWith}
            </AppText>
            <View style={[styles.rule, { backgroundColor: colors.border }]} />
          </View>
          <GhostButton
            tone="neutral"
            size="lg"
            icon="fingerprint"
            label={t.biometric}
            onPress={onBiometric}
            accessibilityHint={t.biometricHint}
            testID="vault.lock.biometric"
          />
        </>
      ) : null}
      {state.notice ? (
        <AppText
          variant="small"
          color="textSecondary"
          align="center"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          testID="vault.lock.notice"
        >
          {t.notices[state.notice]}
        </AppText>
      ) : null}
      {state.error ? (
        <AppText
          variant="small"
          color="danger"
          align="center"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          testID="vault.lock.error"
        >
          {t.passwordFailed}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  header: { paddingHorizontal: PAD_SIDE, gap: GAP },
  titles: { gap: 8 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  lime: {
    paddingTop: LIME_EDGE,
    borderTopLeftRadius: radius.sheetSm,
    borderTopRightRadius: radius.sheetSm,
  },
  sheet: {
    paddingTop: SHEET_PAD,
    paddingHorizontal: PAD_SIDE,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  actions: { gap: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rule: { flex: 1, height: 1 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 24 },
});
