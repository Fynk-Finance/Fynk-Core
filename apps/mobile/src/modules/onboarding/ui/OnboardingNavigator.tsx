// The onboarding flow shown by its gate: Aviso, the four steps (pushed), Listo (no way back),
// Omitir (modal), Conectar banco (M5, pushed from Cuentas) and "Generar un código nuevo" (M2,
// pushed from Listo).
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
import { SkipWarningScreen } from './SkipWarningScreen';
import {
  CONNECT_BANK_ROUTE,
  RECOVERY_CODE_ROUTE,
  SKIP_ROUTE,
  STEP_ROUTES,
  type OnboardingParamList,
  type StepParams,
} from './routes';

const Stack = createNativeStackNavigator<OnboardingParamList>();

/** The screen of each step and Listo (index.ts builds them with the other modules' parts). */
export type StepScreens = Record<StepId | 'done', ComponentType>;

export function initialStateFor(step: WizardStep): InitialState {
  const screens = screensUpTo(step);
  return { index: screens.length - 1, routes: screens.map((s) => ({ name: STEP_ROUTES[s] })) };
}

interface StepsProps {
  initialStep: WizardStep;
  steps: StepScreens;
  connectBank?: ComponentType;
  recoveryCode?: ComponentType;
}

function Steps({ initialStep, steps, connectBank, recoveryCode }: StepsProps) {
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
          {/* Inventory row 27: Listo has no back gesture; its button fades to the tabs. */}
          <Stack.Screen
            name={STEP_ROUTES.done}
            component={steps.done}
            options={screenOptionsFor({ gesture: 'off' }, { reduceMotion })}
          />
          {/* Inventory row 28: Omitir is a modal. */}
          <Stack.Screen
            name={SKIP_ROUTE}
            component={SkipWarningScreen}
            options={screenOptionsFor({ transition: 'modal' }, { reduceMotion })}
          />
          {/* Inventory row 29: pushed with the default transition. */}
          {connectBank ? <Stack.Screen name={CONNECT_BANK_ROUTE} component={connectBank} /> : null}
          {recoveryCode ? (
            <Stack.Screen name={RECOVERY_CODE_ROUTE} component={recoveryCode} />
          ) : null}
        </Stack.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
}

export function createOnboardingNavigator(
  service: OnboardingService,
  steps: StepScreens,
  /** M5's Conectar banco, opened by "Agregar otra cuenta". */
  connectBank?: ComponentType,
  /** M2's "Generar un código nuevo", opened by Listo's pending recovery code row. */
  recoveryCode?: ComponentType,
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
        <Steps
          initialStep={state.progress.step}
          steps={steps}
          connectBank={connectBank}
          recoveryCode={recoveryCode}
        />
      </OnboardingProvider>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  });
