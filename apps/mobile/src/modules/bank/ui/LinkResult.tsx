// What Conectar banco shows after the bank's portal (HU-009: the accounts the bank returned, or a
// clear message; the connection state; authentication errors). Not in the design: new, needs
// design review. Built from the shared states and OnbCuentas.html's rows.
import { StyleSheet, View } from 'react-native';

import { AppText, ErrorState, IconTile, useThemedStyles, type Theme } from '@shared/ui';

import type { LinkOutcome } from '../application/linkBank';
import { BankLinkList } from './BankLinkList';
import { bankStrings } from './strings.es-CO';

const t = bankStrings.link;

export interface LinkResultProps {
  entity: string;
  outcome: Exclude<LinkOutcome, { kind: 'cancelled' }>;
  onRetry: () => void;
}

export function LinkResult({ entity, outcome, onRetry }: LinkResultProps) {
  const styles = useThemedStyles(createStyles);

  if (outcome.kind === 'denied') {
    return (
      <ErrorState title={t.denied.title} message={t.denied.message(entity)} onRetry={onRetry} />
    );
  }
  if (outcome.kind === 'failed') {
    return (
      <ErrorState
        title={t.failedTitle}
        message={t.failed[outcome.reason](entity)}
        onRetry={onRetry}
      />
    );
  }

  const { accounts } = outcome;
  let detail;
  if (accounts === null) detail = <AppText color="textSecondary">{t.accountsLater}</AppText>;
  else if (accounts.length === 0)
    detail = <AppText color="textSecondary">{t.noAccounts(entity)}</AppText>;
  else
    detail = (
      <>
        <AppText color="textSecondary">{t.linkedMessage}</AppText>
        <BankLinkList
          items={accounts.map((a) => ({
            id: a.providerAccountId,
            displayName: a.displayName,
            kind: a.kind,
            balanceMinor: a.balanceMinor,
          }))}
        />
      </>
    );

  return (
    <View style={styles.linked} accessibilityLiveRegion="polite" testID="bank.link.linked">
      <View style={styles.title}>
        <IconTile icon="check" tone="accent" size={44} />
        <AppText variant="section" accessibilityRole="header" style={styles.flex}>
          {t.linked(entity)}
        </AppText>
      </View>
      {detail}
    </View>
  );
}

const createStyles = (_: Theme) =>
  StyleSheet.create({
    linked: { gap: 16 },
    title: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flex: { flex: 1 },
  });
