// Step 2 · Cuentas (OnbCuentas): "Cuentas bancarias" with the connected count, M5's BankLinkList
// and "Agregar otra cuenta" (ConnectBankButton, opens Conectar banco), M6's CashInput, and
// "Total registrado", which follows the cash field as the person types. "Continuar" is always
// enabled; it saves the cash first when the field holds a new amount.
// The other modules' parts arrive as functions read on render: @modules/accounts and
// @modules/bank import each other and this module, so nothing is read while files load.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Account, MoneyMinor } from '@shared/domain/types';
import { AmountText, AppText, radius, useThemedStyles, type Theme } from '@shared/ui';

import type { AccountsOverview, CashInputProps } from '@modules/accounts';

import {
  cashToSave,
  linkedAccountRows,
  registeredTotal,
  savedCashMinor,
  type LinkedAccountRow,
} from '../domain/accountsStep';
import { StepLayout } from './StepLayout';
import { onboardingStrings } from './strings.es-CO';
import { useStepActions } from './useStepActions';

const copy = onboardingStrings.accounts;

export interface AccountsStepDeps {
  /** M6's accounts and totals (undefined while they load). */
  useAccounts: () => { data?: AccountsOverview };
  /** M6's rule of a connected account. */
  isConnected: (account: Account) => boolean;
  /** M6: registers or updates the cash. */
  setCash: (amountMinor: MoneyMinor) => Promise<void>;
  /** M5's BankLinkList. */
  renderLinkList: (items: readonly LinkedAccountRow[]) => ReactNode;
  /** M5's ConnectBankButton. */
  renderConnectButton: () => ReactNode;
  /** M6's CashInput. */
  renderCashInput: (props: CashInputProps) => ReactNode;
}

export function createAccountsStep(deps: AccountsStepDeps) {
  return function AccountsStepScreen() {
    const styles = useThemedStyles(createStyles);
    const actions = useStepActions('accounts');
    const overview = deps.useAccounts().data;
    // Undefined until the person types: the field shows the saved cash until then.
    const [typed, setTyped] = useState<MoneyMinor | null | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const accounts = overview?.accounts ?? [];
    const rows = linkedAccountRows(accounts, deps.isConnected);
    const saved = savedCashMinor(accounts);
    const cash = typed === undefined ? saved : typed;
    const connectedCount = overview?.connectedCount ?? 0;
    const total = registeredTotal(overview?.balanceTotalMinor ?? 0, saved, cash);

    const save = async () => {
      if (saving) return;
      const amount = cashToSave(saved, cash);
      if (amount !== null) {
        setSaving(true);
        setSaveError(null);
        try {
          await deps.setCash(amount);
        } catch {
          setSaveError(copy.cashNotSaved);
          setSaving(false);
          return;
        }
        setSaving(false);
      }
      await actions.complete();
    };

    return (
      <StepLayout step="accounts" actions={actions} onContinue={() => void save()} busy={saving}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="cardTitle" accessibilityRole="header" style={styles.sectionTitle}>
              {copy.banks}
            </AppText>
            {overview ? (
              <AppText
                variant="captionStrong"
                color="textSecondary"
                testID="onboarding.accounts.count"
              >
                {copy.connected(connectedCount)}
              </AppText>
            ) : null}
          </View>
          {rows.length ? deps.renderLinkList(rows) : null}
          {deps.renderConnectButton()}
        </View>

        <View style={styles.section}>
          <AppText variant="cardTitle" accessibilityRole="header" style={styles.sectionTitle}>
            {copy.cash}
          </AppText>
          {deps.renderCashInput({
            value: cash,
            onChange: (next) => {
              setTyped(next);
              setSaveError(null);
            },
            error: saveError ?? undefined,
            testID: 'onboarding.accounts.cash',
          })}
        </View>

        <View style={styles.total} testID="onboarding.accounts.total">
          <View style={styles.totalText}>
            <AppText variant="smallStrong">{copy.total}</AppText>
            <AppText variant="caption" color="textSecondary">
              {copy.totalDetail(connectedCount, (cash ?? 0) > 0)}
            </AppText>
          </View>
          <AmountText amountMinor={total} size={17} color="primaryDeep" />
        </View>
      </StepLayout>
    );
  };
}

// OnbCuentas.html: sections 8 apart inside, titles Space Grotesk 700 18/24, the count 12/16
// semibold; "Total registrado" padding 8/16, radius 16 on the soft blue, amount 17/22 mono.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    section: { gap: 8 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: { fontSize: 18, lineHeight: 24 },
    total: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
    },
    totalText: { flexShrink: 1, gap: 2 },
  });
