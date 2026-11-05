// Detectamos pagos recurrentes (SCRUM-55, M9 prompt). New screen, needs design review: it is
// built from the shared kit. Pushed with the default transition from the Billetera banner or
// from the inbox notice after a sync with new proposals.
//
// One card per proposal: name, "Suscripción" or "Gasto fijo", amount, periodicity and next
// charge, with "Confirmar" and "Descartar". Nothing is added without the person; the name and
// the amount can be edited afterwards with "Editar".
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountText,
  AppText,
  BackButton,
  Badge,
  Card,
  EmptyState,
  GhostButton,
  IconTile,
  PrimaryButton,
  Screen,
  Skeleton,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { DetectionService } from '../application/detectionService';
import { PERIODICITY_LABEL, dayMonth } from '../domain/card';
import type { Proposal } from '../domain/detect';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.detected;

export const DETECTED_ROUTE = 'recurring.Detected' as const;

export function createDetectedScreen({
  detection,
  subscribe,
}: {
  detection: Pick<DetectionService, 'pending' | 'confirm' | 'dismiss'>;
  /** Reload when the proposals change (a sync while the screen is open). */
  subscribe?: (listener: () => void) => () => void;
}) {
  return function DetectedScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [proposals, setProposals] = useState<Proposal[] | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [failure, setFailure] = useState<string | null>(null);

    const load = useCallback(async () => {
      try {
        setProposals(await detection.pending());
      } catch {
        setProposals([]);
      }
    }, []);

    useEffect(() => {
      void load();
      return subscribe?.(() => void load());
    }, [load]);

    const decide = (p: Proposal, action: 'confirm' | 'dismiss') => {
      setBusy(p.merchantKey);
      setFailure(null);
      const task =
        action === 'confirm'
          ? detection.confirm(p.merchantKey).then(() => undefined)
          : detection.dismiss(p.merchantKey);
      task
        .then(load)
        .catch(() => setFailure(t.failed))
        .finally(() => setBusy(null));
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {t.title}
        </AppText>
        <AppText variant="small" color="textSecondary">
          {t.subtitle}
        </AppText>
      </View>
    );

    return (
      <Screen header={header} scroll padded testID="recurring.detected">
        {proposals === null ? (
          <Skeleton height={160} radius={radius.card} />
        ) : proposals.length === 0 ? (
          <EmptyState title={t.emptyTitle} message={t.emptyMessage} icon="sync" />
        ) : (
          proposals.map((p) => (
            <Card key={p.merchantKey} testID={`recurring.detected.${p.merchantKey}`}>
              <View style={styles.top}>
                <IconTile
                  icon={p.kind === 'subscription' ? 'play' : 'calendar'}
                  tone="accent"
                  size={40}
                />
                <View style={styles.texts}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {p.name}
                  </AppText>
                  <View style={styles.inline}>
                    <Badge label={p.kind === 'subscription' ? t.subscription : t.fixed} size="sm" />
                    <Badge label={PERIODICITY_LABEL[p.schedule.periodicity]} size="sm" />
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {t.next(dayMonth(p.nextChargeOn))}
                  </AppText>
                </View>
                <AmountText amountMinor={p.amountMinor} size={16} />
              </View>
              <View style={styles.actions}>
                <View style={styles.action}>
                  <GhostButton
                    label={t.dismiss}
                    tone="neutral"
                    disabled={busy !== null}
                    onPress={() => decide(p, 'dismiss')}
                    accessibilityHint={t.dismissLabel(p.name)}
                    testID={`recurring.detected.${p.merchantKey}.dismiss`}
                  />
                </View>
                <View style={styles.action}>
                  <PrimaryButton
                    label={t.confirm}
                    loading={busy === p.merchantKey}
                    disabled={busy !== null && busy !== p.merchantKey}
                    onPress={() => decide(p, 'confirm')}
                    accessibilityHint={t.confirmLabel(p.name)}
                    testID={`recurring.detected.${p.merchantKey}.confirm`}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
        {failure ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {failure}
          </AppText>
        ) : null}
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    texts: { flexGrow: 1, flexShrink: 1, gap: 4 },
    inline: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
    action: { flex: 1 },
  });
