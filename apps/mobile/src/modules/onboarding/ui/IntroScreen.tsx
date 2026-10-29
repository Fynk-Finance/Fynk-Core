// Aviso (OnbIntro): the full blue screen with the illustration, "4 pasos" and "3 minutos",
// "Comenzar configuración" and "Omitir por ahora". "Comenzar" shrinks the blue panel into the
// step header (0.7 s, cubic-bezier(.76,0,.24,1)) while the content leaves, then shows step 1
// without a slide, so the header stays in place. Coming back grows it again. With reduced
// motion the step simply fades in.
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import {
  AppText,
  FynkLogo,
  Icon,
  Shine,
  fonts,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { TOTAL_STEPS } from '../domain/steps';
import { ILLUSTRATION_HEIGHT, IntroIllustration } from './IntroIllustration';
import { useOnboarding } from './OnboardingContext';
import { PANEL_HEIGHT, StepPanelShapes } from './StepLayout';
import { SKIP_ROUTE, STEP_ROUTES, type OnboardingParamList } from './routes';
import { onboardingStrings } from './strings.es-CO';
import { useRise } from './useRise';

const copy = onboardingStrings.intro;
export const MORPH_MS = 700;
const MORPH = { duration: MORPH_MS, easing: Easing.bezier(0.76, 0, 0.24, 1) };

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"
        stroke="#ffffff"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The four rounded squares of the full blue screen (390 × 844). */
function FullScreenShapes() {
  const { colors } = useTheme();
  return (
    <Svg width={390} height={844} viewBox="0 0 390 844">
      <Rect x={250} y={-90} width={220} height={220} rx={52} fill={colors.headerShapeA} />
      <Rect x={-80} y={380} width={150} height={150} rx={36} fill={colors.primaryPressed} />
      <Rect x={300} y={700} width={170} height={170} rx={40} fill={colors.primaryPressed} />
      <Rect x={-60} y={760} width={110} height={110} rx={28} fill={colors.headerShapeA} />
    </Svg>
  );
}

export function IntroScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const service = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingParamList>>();
  const rise = useRise();
  const morph = useSharedValue(0);
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [art, setArt] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Back from step 1: save Aviso as the current screen and grow the panel again.
  useFocusEffect(
    useCallback(() => {
      service.visit('intro').catch(() => undefined);
      if (morph.get() > 0) morph.set(reduceMotion ? 0 : withTiming(0, MORPH));
    }, [morph, reduceMotion, service]),
  );

  const begin = async () => {
    if (leaving) return;
    setLeaving(true);
    setFailed(false);
    try {
      await service.begin();
    } catch {
      setFailed(true);
      setLeaving(false);
      return;
    }
    if (reduceMotion) {
      navigation.navigate(STEP_ROUTES.name);
      setLeaving(false);
      return;
    }
    morph.set(withTiming(1, MORPH));
    timer.current = setTimeout(() => {
      navigation.navigate(STEP_ROUTES.name, { fromIntro: true });
      setLeaving(false);
    }, MORPH_MS);
  };

  const panelHeight = insets.top + PANEL_HEIGHT;
  const panel = useAnimatedStyle(() => {
    const r = interpolate(morph.value, [0, 1], [0, radius.sheetSm]);
    return {
      height: interpolate(morph.value, [0, 1], [height, panelHeight]),
      borderBottomLeftRadius: r,
      borderBottomRightRadius: r,
    };
  });
  const fullShapes = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.64], [1, 0], Extrapolation.CLAMP),
  }));
  const headerShapes = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.64], [0, 1], Extrapolation.CLAMP),
  }));
  // `ob-out`: opacity .32 s ease-in, up 36 px in .4 s.
  const out = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.46], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(morph.value, [0, 0.57], [0, -36], Extrapolation.CLAMP) }],
  }));

  // The illustration shrinks on short phones so it never runs under the text.
  const onArtLayout = (e: LayoutChangeEvent) => {
    const room = e.nativeEvent.layout.height;
    setArt(Math.min(1, room / ILLUSTRATION_HEIGHT));
  };

  return (
    <View style={styles.root} testID="onboarding.intro">
      <Animated.View style={[styles.panel, panel]}>
        <Animated.View style={[StyleSheet.absoluteFill, fullShapes]}>
          <FullScreenShapes />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { top: insets.top }, headerShapes]}>
          <StepPanelShapes />
        </Animated.View>
        <Shine distance={620} height={920} width={56} opacity={0.12} />
      </Animated.View>

      <Animated.View style={[styles.content, { paddingTop: insets.top }, out]}>
        <View style={styles.logo}>
          <FynkLogo height={35} color={colors.onPrimary} />
        </View>
        <View style={styles.art} onLayout={onArtLayout}>
          <View style={{ transform: [{ scale: art }] }}>
            <IntroIllustration />
          </View>
        </View>
        <Animated.View
          style={[styles.bottom, { paddingBottom: Math.max(32, insets.bottom + 16) }, rise]}
        >
          <View style={styles.chips}>
            <View style={[styles.chip, styles.chipSteps]}>
              <AppText style={styles.chipText}>{copy.steps(TOTAL_STEPS)}</AppText>
            </View>
            <View style={[styles.chip, styles.chipTime]}>
              <ClockIcon />
              <AppText style={styles.chipText}>{copy.minutes}</AppText>
            </View>
          </View>
          <AppText
            variant="display"
            color="onPrimary"
            accessibilityRole="header"
            style={styles.title}
          >
            {copy.title}
          </AppText>
          <AppText color="onPrimary" style={styles.text}>
            {copy.text}
          </AppText>
          {failed ? (
            <AppText
              variant="small"
              color="onPrimary"
              accessibilityLiveRegion="polite"
              style={styles.error}
            >
              {uiStrings.errorMessage}
            </AppText>
          ) : null}
          <Pressable
            onPress={() => void begin()}
            disabled={leaving}
            accessibilityRole="button"
            accessibilityLabel={copy.start}
            accessibilityState={{ disabled: leaving }}
            testID="onboarding.intro.start"
            style={({ pressed }) => [styles.cta, pressed ? styles.ctaPressed : null]}
          >
            <AppText style={styles.ctaText}>{copy.start}</AppText>
            <Icon name="arrowRight" size={20} color={colors.primaryDeep} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate(SKIP_ROUTE)}
            disabled={leaving}
            accessibilityRole="button"
            testID="onboarding.intro.skip"
            style={styles.skip}
          >
            <AppText color="onPrimary" style={styles.skipText}>
              {copy.skip}
            </AppText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    panel: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.primary,
      overflow: 'hidden',
    },
    content: { flex: 1 },
    logo: { paddingTop: 48, paddingHorizontal: 24, alignItems: 'flex-start' },
    art: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
    bottom: { paddingHorizontal: 24 },
    chips: { flexDirection: 'row', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      borderRadius: radius.pill,
    },
    chipSteps: { backgroundColor: colors.onPrimaryOverlay },
    chipTime: { backgroundColor: colors.accent },
    chipText: {
      color: colors.onPrimary,
      fontFamily: fonts.body.bold,
      fontSize: 13,
      lineHeight: 18,
    },
    title: { marginTop: 16 },
    // 16/24 medium at 92 %.
    text: {
      marginTop: 8,
      fontFamily: fonts.body.medium,
      fontSize: 16,
      lineHeight: 24,
      opacity: 0.92,
    },
    error: { marginTop: 8 },
    // White on blue in light, the dark surface in dark; 17 px bold, radius 18.
    cta: {
      marginTop: 24,
      height: 56,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.background,
      ...shadow.card,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.45,
      shadowRadius: 10,
      elevation: 6,
    },
    ctaPressed: { backgroundColor: colors.surfaceBlueSoft },
    ctaText: { color: colors.primaryDeep, fontFamily: fonts.body.bold, fontSize: 17 },
    skip: { marginTop: 16, alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
    skipText: { fontFamily: fonts.body.bold, fontSize: 15, lineHeight: 20, opacity: 0.88 },
  });
