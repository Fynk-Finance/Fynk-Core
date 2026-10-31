// Steps whose content is still to be built: Cuentas (M5 bank links, M6 cash),
// Metas (M8 goal form) and Gastos recurrentes (M9 recurring form). The frame, the step bar,
// "Omitir" and "Continuar" already work, so the setup can be finished end to end.
// TODO(M5) SCRUM-23 embed BankLinkList and ConnectBankButton from @modules/bank.
// TODO(M6) SCRUM-69 embed CashInput from @modules/accounts.
// TODO(M8) SCRUM-51 embed GoalForm and GoalCardCompact from @modules/savings.
// TODO(M9) SCRUM-54 embed RecurringQuickList and RecurringForm from @modules/recurring.
import { StyleSheet, View } from 'react-native';

import { AppText, IconTile, radius, useThemedStyles, type IconName, type Theme } from '@shared/ui';

import type { StepId } from '../domain/steps';
import { StepLayout } from './StepLayout';
import { onboardingStrings } from './strings.es-CO';
import { useStepActions } from './useStepActions';

const OWNER: Record<StepId, { owner: string; icon: IconName }> = {
  name: { owner: 'M3 · Configuración', icon: 'user' },
  accounts: { owner: 'M5 · Banco y M6 · Cuentas', icon: 'bank' },
  goals: { owner: 'M8 · Metas de ahorro', icon: 'goal' },
  recurring: { owner: 'M9 · Gastos recurrentes y suscripciones', icon: 'calendar' },
};

export function createPlaceholderStep(step: StepId) {
  const { owner, icon } = OWNER[step];
  return function PlaceholderStep() {
    const styles = useThemedStyles(createStyles);
    const actions = useStepActions(step);
    return (
      <StepLayout step={step} actions={actions}>
        <View style={styles.card}>
          <IconTile icon={icon} tone="soft" size={44} />
          <View style={styles.text}>
            <AppText variant="label">{onboardingStrings.placeholder.comingSoon}</AppText>
            <AppText variant="small" color="textSecondary">
              {onboardingStrings.placeholder.builtBy(owner)}
            </AppText>
          </View>
        </View>
      </StepLayout>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: radius.button,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    text: { flex: 1, gap: 2 },
  });
