// The frame of every step (OnbNombre, OnbCuentas, OnbMetas, OnbGastos): the blue panel with its
// rounded squares and shine, the step bar, title and subtitle, the content that rises in, and
// the bottom bar with "Continuar". The design frame has no status bar, so the panel grows by
// the top inset.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import {
  AppText,
  PrimaryButton,
  Shine,
  StepProgress,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { LAST_STEP, TOTAL_STEPS, stepNumber, type StepId } from '../domain/steps';
import { onboardingStrings } from './strings.es-CO';
import type { StepActions } from './useStepActions';
import { useRise } from './useRise';

/** Height of the blue panel in the design, below the status bar. */
export const PANEL_HEIGHT = 206;

export interface StepLayoutProps {
  step: StepId;
  actions: StepActions;
  children?: ReactNode;
  /** False while the step is not valid: "Continuar" stays disabled. */
  canContinue?: boolean;
  /** Replaces "Continuar" when the step saves something first (Nombre saves the name). */
  onContinue?: () => void;
  /** The step's own save is running. */
  busy?: boolean;
}

/** The decorative squares of the step panel (390 × 206 in the design). */
export function StepPanelShapes() {
  const { colors } = useTheme();
  return (
    <Svg width={390} height={PANEL_HEIGHT} viewBox="0 0 390 206" style={StyleSheet.absoluteFill}>
      <Rect x={250} y={-80} width={210} height={210} rx={48} fill={colors.headerShapeA} />
      <Rect x={312} y={-28} width={104} height={104} rx={26} fill={colors.headerShapeB} />
      <Rect x={-60} y={116} width={150} height={150} rx={36} fill={colors.primaryPressed} />
    </Svg>
  );
}

export function StepLayout({
  step,
  actions,
  children,
  canContinue = true,
  onContinue,
  busy = false,
}: StepLayoutProps) {
  const working = busy || actions.busy;
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const rise = useRise();
  const copy = onboardingStrings.steps[step];
  const last = step === LAST_STEP;

  return (
    <View style={styles.root} testID={`onboarding.step.${step}`}>
      <View style={[styles.panel, { minHeight: insets.top + PANEL_HEIGHT }]}>
        <View style={[StyleSheet.absoluteFill, { top: insets.top }]}>
          <StepPanelShapes />
        </View>
        <Shine distance={620} height={286} width={50} opacity={0.12} />
        <View style={{ paddingTop: insets.top + 16 }}>
          <StepProgress
            step={stepNumber(step)}
            total={TOTAL_STEPS}
            onBack={actions.back}
            onSkip={working ? undefined : () => void actions.skip()}
          />
          <AppText
            variant="title"
            color="onPrimary"
            accessibilityRole="header"
            style={styles.title}
          >
            {copy.title}
          </AppText>
          <AppText variant="subtitle" color="onPrimary" style={styles.subtitle}>
            {copy.subtitle}
          </AppText>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Animated.View style={[styles.content, rise]}>{children}</Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
        {actions.failed ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {uiStrings.errorMessage}
          </AppText>
        ) : null}
        <PrimaryButton
          label={last ? onboardingStrings.step.finish : onboardingStrings.step.continue}
          withArrow
          onPress={onContinue ?? (() => void actions.complete())}
          disabled={!canContinue}
          loading={working}
          testID="onboarding.continue"
        />
      </View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    panel: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    // 28/34 Space Grotesk, letter-spacing −0.01em; subtitle 14/20 medium at 92 %.
    title: { marginTop: 24 },
    subtitle: { marginTop: 8, opacity: 0.92 },
    scroll: { flex: 1 },
    body: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16 },
    content: { gap: 16 },
    footer: {
      gap: 8,
      paddingTop: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
  });
