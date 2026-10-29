// The onboarding flow shown by its gate: Aviso, the four steps (pushed), and Omitir (modal).
// It opens on the saved step with the earlier screens behind it, so back still works after the
// app was closed. The stack has its own container: it starts from the saved state, and the gate
// replaces the whole flow with the tabs when the setup ends. Until the progress is read it draws
// only the background.
import {
  NavigationContainer,
  NavigationIndependentTree,
  useTheme as useNavigationTheme,
  type InitialState,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { screenOptionsFor } from '@shared/navigation';
import { ErrorState, useThemedStyles, type Theme } from '@shared/ui';

import type { OnboardingService } from '../application/onboardingService';
import { screensUpTo, type WizardStep } from '../domain/progress';
import type { StepId } from '../domain/steps';
import { IntroScreen } from './IntroScreen';
import { OnboardingProvider, useOnboardingState } from './OnboardingContext';
import { createPlaceholderStep } from './PlaceholderStep';
import { SkipWarningScreen } from './SkipWarningScreen';
import { SKIP_ROUTE, STEP_ROUTES, type OnboardingParamList, type StepParams } from './routes';

const Stack = createNativeStackNavigator<OnboardingParamList>();

/** The screen of each step. Steps 2 to 4 wait for M5, M6, M8 and M9 (see PlaceholderStep). */
export type StepScreens = Record<StepId, ComponentType>;

export const placeholderSteps: StepScreens = {
  name: createPlaceholderStep('name'),
  accounts: createPlaceholderStep('accounts'),
  goals: createPlaceholderStep('goals'),
  recurring: createPlaceholderStep('recurring'),
};

export function initialStateFor(step: WizardStep): InitialState {
  const screens = screensUpTo(step);
  return { index: screens.length - 1, routes: screens.map((s) => ({ name: STEP_ROUTES[s] })) };
}

function Steps({ initialStep, steps }: { initialStep: WizardStep; steps: StepScreens }) {
  const navigationTheme = useNavigationTheme();
  const reduceMotion = useReducedMotion();
  // Read once: later moves are made by the screens themselves.
  const [initialState] = useState(() => initialStateFor(initialStep));

  const push = screenOptionsFor({}, { reduceMotion });
  const stepOptions = ({
    route,
  }: {
    route: { params?: StepParams };
  }): NativeStackNavigationOptions =>
    route.params?.fromIntro && !reduceMotion ? { ...push, animation: 'none' } : push;

  return (
    <NavigationIndependentTree>
      <NavigationContainer theme={navigationTheme} initialState={initialState}>
        <Stack.Navigator screenOptions={{ headerShown: false, ...push }}>
          <Stack.Screen name={STEP_ROUTES.intro} component={IntroScreen} />
          <Stack.Screen name={STEP_ROUTES.name} component={steps.name} options={stepOptions} />
          <Stack.Screen
            name={STEP_ROUTES.accounts}
            component={steps.accounts}
            options={stepOptions}
          />
          <Stack.Screen name={STEP_ROUTES.goals} component={steps.goals} options={stepOptions} />
          <Stack.Screen
            name={STEP_ROUTES.recurring}
            component={steps.recurring}
            options={stepOptions}
          />
          {/* Inventory row 28: Omitir is a modal. */}
          <Stack.Screen
            name={SKIP_ROUTE}
            component={SkipWarningScreen}
            options={screenOptionsFor({ transition: 'modal' }, { reduceMotion })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

export function createOnboardingNavigator(
  service: OnboardingService,
  steps: StepScreens = placeholderSteps,
) {
  return function OnboardingNavigator() {
    const styles = useThemedStyles(createStyles);
    const state = useOnboardingState(service);

    // The gate opens right after the vault: read the progress if nothing read it yet.
    useEffect(() => {
      if (state.status === 'unknown') void service.load();
    }, [state.status]);

    if (state.status === 'failed') {
      return (
        <View style={styles.root}>
          <ErrorState onRetry={() => void service.load()} />
        </View>
      );
    }
    if (state.status !== 'ready') return <View style={styles.root} testID="onboarding.loading" />;

    return (
      <OnboardingProvider value={service}>
        <Steps initialStep={state.progress.step} steps={steps} />
      </OnboardingProvider>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  });
