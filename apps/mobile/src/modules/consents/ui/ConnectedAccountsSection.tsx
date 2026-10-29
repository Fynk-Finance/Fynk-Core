// "Cuentas conectadas" of Privacidad y datos (CfgPrivacidad.html), ready for M13 to place in that
// screen: the live consents with the red "Revocar" chip of the design, which revokes at once.
// Renders nothing while there is no live consent.
import { StyleSheet, View } from 'react-native';

import type { Clock } from '@shared/domain/types';
import { AppText, Card, radius, useThemedStyles, type Theme } from '@shared/ui';

import { canRevoke, entityName, sortForList, statusAt } from '../domain/consentList';
import type { ConsentsApiPort } from '../application/ports';
import type { Revocation } from '../application/revocation';
import { useConsents, useEntityNames } from '../application/useConsents';
import { ConsentRow } from './ConsentRow';
import { SectionLabel } from './ConsentsPage';
import { consentsStrings } from './strings.es-CO';
import { useRevokeFlow } from './useRevokeFlow';

const t = consentsStrings.connected;

export interface ConnectedAccountsDeps {
  api: ConsentsApiPort;
  clock: Clock;
  revocation: Revocation;
}

export function createConnectedAccountsSection({ api, clock, revocation }: ConnectedAccountsDeps) {
  return function ConnectedAccountsSection() {
    const styles = useThemedStyles(createStyles);
    const consents = useConsents(api);
    const names = useEntityNames(api);
    const flow = useRevokeFlow(revocation);

    const now = clock.now();
    const live = sortForList(
      (consents.data ?? []).map((c) => ({ ...c, status: statusAt(c, now) })),
    ).filter((c) => canRevoke(c.status));

    if (live.length === 0 && !flow.outcome) return null;
    return (
      <View style={styles.section} testID="consents.connected">
        <SectionLabel title={t.section} meta={t.meta} />
        {live.length > 0 ? (
          <Card style={styles.group}>
            {live.map((consent, i) => {
              const entity = entityName(consent.provider, names.data ?? {});
              return (
                <ConsentRow
                  key={consent.id}
                  consent={consent}
                  status={consent.status}
                  entity={entity}
                  first={i === 0}
                  onRevoke={() => void flow.start(consent, entity)}
                />
              );
            })}
          </Card>
        ) : null}
        {flow.outcome ? (
          <AppText
            variant="small"
            color={flow.outcome.kind === 'revoked' ? 'textSecondary' : 'danger'}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {flow.outcome.message}
          </AppText>
        ) : null}
      </View>
    );
  };
}

const createStyles = (_: Theme) =>
  StyleSheet.create({
    section: { gap: 8 },
    group: { borderRadius: radius.cardLg, paddingVertical: 0, paddingHorizontal: 16 },
  });
