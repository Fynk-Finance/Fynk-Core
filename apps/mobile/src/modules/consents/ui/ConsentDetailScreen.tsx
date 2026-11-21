// Consent detail (HU-007, HU-008): the entity and its status, the same scope list as Conectar
// banco with the purpose and term, the dates and the text version, and the red "Revocar acceso".
// New screen built from the cards of ConectarBanco.html and the danger button of the design:
// needs design review. Pushed, default transition.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Clock } from '@shared/domain/types';
import {
  AppText,
  Card,
  ErrorState,
  GhostButton,
  Skeleton,
  radius,
  uiStrings,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { canRevoke, entityName, shortDate, statusAt } from '../domain/consentList';
import type { ConsentsApiPort } from '../application/ports';
import type { Revocation } from '../application/revocation';
import { useConsent, useEntityNames } from '../application/useConsents';
import { ConsentScopeCard } from './ConsentScopeCard';
import { StatusChip, dateLines } from './ConsentRow';
import { PageHeader } from './ConsentsPage';
import type { ConsentDetailParams } from './routes';
import { consentsStrings } from './strings.es-CO';
import { useRevokeFlow } from './useRevokeFlow';

const t = consentsStrings;

export interface ConsentDetailDeps {
  api: ConsentsApiPort;
  clock: Clock;
  revocation: Revocation;
}

export function createConsentDetailScreen({ api, clock, revocation }: ConsentDetailDeps) {
  return function ConsentDetailScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const { params } = useRoute<RouteProp<{ detail: ConsentDetailParams }, 'detail'>>();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const query = useConsent(api, params.id);
    const names = useEntityNames(api);
    const flow = useRevokeFlow(revocation);

    const consent = query.data;
    const entity = consent ? entityName(consent.provider, names.data ?? {}) : '';
    const status = consent ? statusAt(consent, clock.now()) : undefined;

    let body;
    if (query.isError) {
      body = <ErrorState message={t.detail.error} onRetry={() => void query.refetch()} />;
    } else if (!consent || !status) {
      body = (
        <View style={styles.loading} accessible accessibilityLabel={uiStrings.loading}>
          <Skeleton height={180} radius={radius.card} />
          <Skeleton height={96} radius={radius.card} />
        </View>
      );
    } else {
      const facts = [...dateLines(consent, status), t.detail.version(consent.textVersion)];
      if (status === 'revoked') {
        facts.push(
          consent.providerNotifiedAt
            ? t.detail.notified(shortDate(consent.providerNotifiedAt))
            : t.detail.notifying,
        );
      }
      body = (
        <>
          <ConsentScopeCard entityName={entity} scopes={consent.scopes} text={consent} />
          <Card style={styles.facts} testID="consents.detail.facts">
            {facts.map((fact) => (
              <AppText key={fact} variant="small" color="textSecondary">
                {fact}
              </AppText>
            ))}
          </Card>
          {flow.outcome ? (
            <AppText
              variant="smallStrong"
              color={flow.outcome.kind === 'revoked' ? 'textPrimary' : 'danger'}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID="consents.detail.outcome"
            >
              {flow.outcome.message}
            </AppText>
          ) : null}
          {canRevoke(status) ? (
            <GhostButton
              tone="danger"
              label={t.revoke.button}
              loading={flow.isPending}
              onPress={() => void flow.start(consent, entity)}
              testID="consents.detail.revoke"
            />
          ) : null}
        </>
      );
    }

    return (
      <View style={styles.root} testID="consents.detailScreen">
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <PageHeader
            icon="bank"
            title={entity || t.list.title}
            backLabel={t.detail.back}
            onBack={() => navigation.goBack()}
          >
            {status ? (
              <View style={styles.status}>
                <StatusChip status={status} />
              </View>
            ) : null}
          </PageHeader>
          {body}
        </ScrollView>
      </View>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, gap: 16 },
    status: { flexDirection: 'row', marginTop: 8 },
    facts: { padding: 16, gap: 6 },
    loading: { gap: 16 },
  });
