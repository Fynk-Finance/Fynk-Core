// "¿Seguro que quieres omitir la configuración?" (OnbOmitir), shown as a modal: what stays
// pending, "Seguir configurando" to go back, and "Omitir de todos modos", which ends the setup;
// the gate then closes and the app fades to the Dashboard.
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import {
  AppText,
  BackButton,
  GhostButton,
  IconTile,
  PrimaryButton,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

import { useOnboarding } from './OnboardingContext';
import { onboardingStrings } from './strings.es-CO';
import { useRise } from './useRise';

const copy = onboardingStrings.skip;

const PENDING: { icon: IconName; text: string }[] = [
  { icon: 'chartLine', text: copy.pending.balance },
  { icon: 'goal', text: copy.pending.goals },
  { icon: 'bell', text: copy.pending.reminders },
];

/** The clock of "Puedes configurarlo después" (not in the shared icon set). */
function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SkipWarningScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const service = useOnboarding();
  const rise = useRise();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const skipAnyway = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await service.skipAll();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="onboarding.skip">
      <Svg width={390} height={300} viewBox="0 0 390 300" style={StyleSheet.absoluteFill}>
        <Rect x={250} y={-70} width={190} height={190} rx={44} fill={colors.surfaceBlue} />
        <Rect x={-60} y={150} width={140} height={140} rx={34} fill={colors.surfaceBlueSoft} />
      </Svg>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: Math.max(32, insets.bottom + 16) },
        ]}
      >
        <Animated.View style={[styles.fill, rise]}>
          <BackButton
            tone="plain"
            accessibilityLabel={copy.back}
            onPress={() => navigation.goBack()}
          />
          <View style={styles.tile}>
            <IconTile icon="warning" tone="danger" size={72} />
          </View>
          <AppText variant="screenTitle" accessibilityRole="header" style={styles.title}>
            {copy.title}
          </AppText>
          <AppText color="textSecondary" style={styles.text}>
            {copy.text}
          </AppText>
          <AppText color="textSecondary" style={styles.pendingTitle}>
            {copy.pendingTitle}
          </AppText>

          <View style={styles.list} accessibilityRole="list">
            {PENDING.map((item) => (
              <View key={item.icon} style={styles.item}>
                <IconTile icon={item.icon} tone="soft" size={32} />
                <AppText variant="subtitle" style={styles.itemText}>
                  {item.text}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.later}>
            <ClockIcon color={colors.primaryDark} />
            <AppText variant="small" color="textSecondary">
              {copy.later}
            </AppText>
          </View>

          <View style={styles.buttons}>
            {failed ? (
              <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
                {uiStrings.errorMessage}
              </AppText>
            ) : null}
            <PrimaryButton
              label={copy.keepGoing}
              onPress={() => navigation.goBack()}
              disabled={busy}
              testID="onboarding.skip.keepGoing"
            />
            <GhostButton
              label={copy.skipAnyway}
              size="lg"
              onPress={() => void skipAnyway()}
              loading={busy}
              testID="onboarding.skip.anyway"
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
    content: { flexGrow: 1, paddingHorizontal: 24 },
    fill: { flexGrow: 1 },
    tile: { marginTop: 40, alignItems: 'flex-start' },
    // 26/32 Space Grotesk, letter-spacing −0.01em.
    title: { marginTop: 24, letterSpacing: -0.26 },
    text: { marginTop: 8 },
    pendingTitle: { marginTop: 16 },
    list: {
      marginTop: 24,
      padding: 16,
      gap: 8,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      ...shadow.card,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemText: { flex: 1, fontSize: 14, lineHeight: 19 },
    later: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    buttons: { marginTop: 'auto', paddingTop: 24, gap: 8 },
  });
