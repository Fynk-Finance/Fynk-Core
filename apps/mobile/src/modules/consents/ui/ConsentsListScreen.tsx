// Consentimientos (HU-007): one row per consent with its entity, status chip, "Otorgado el" and
// "Vence el", fetched again on every visit and with pull to refresh. New screen built from
// "Cuentas conectadas" of CfgPrivacidad.html: needs design review. Pushed, default transition.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Clock } from '@shared/domain/types';
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { entityName, sortForList, statusAt } from '../domain/consentList';
import type { ConsentsApiPort } from '../application/ports';
import { useConsents, useEntityNames } from '../application/useConsents';
import { ConsentRow } from './ConsentRow';
import { PageHeader, SectionLabel } from './ConsentsPage';
import { CONNECT_BANK_ROUTE, CONSENT_DETAIL_ROUTE } from './routes';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings.list;

export interface ConsentsListDeps {
  api: ConsentsApiPort;
  clock: Clock;
}

export function createConsentsListScreen({ api, clock }: ConsentsListDeps) {
  return function ConsentsListScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const consents = useConsents(api);
    const names = useEntityNames(api);

    const now = clock.now();
    const items = sortForList(
      (consents.data ?? []).map((c) => ({ ...c, status: statusAt(c, now) })),
    );

    let body;
    if (consents.isError) {
      body = <ErrorState message={t.error} onRetry={() => void consents.refetch()} />;
    } else if (consents.isPending) {
      body = (
        <View style={styles.loading} accessible accessibilityLabel={uiStrings.loading}>
          <Skeleton height={76} radius={radius.cardLg} />
          <Skeleton height={76} radius={radius.cardLg} />
        </View>
      );
    } else if (items.length === 0) {
      body = (
        <EmptyState
          icon="bank"
          title={t.empty}
          message={t.emptyMessage}
          actionLabel={t.connect}
          onAction={() => navigation.navigate(CONNECT_BANK_ROUTE)}
        />
      );
    } else {
      body = (
        <View style={styles.section}>
          <SectionLabel title={t.section} meta={t.sectionMeta} />
          <Card style={styles.group} testID="consents.list">
            {items.map((consent, i) => (
              <ConsentRow
                key={consent.id}
                consent={consent}
                status={consent.status}
                entity={entityName(consent.provider, names.data ?? {})}
                first={i === 0}
                onOpen={() => navigation.navigate(CONSENT_DETAIL_ROUTE, { id: consent.id })}
              />
            ))}
          </Card>
        </View>
      );
    }

    return (
      <View style={styles.root} testID="consents.listScreen">
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          testID="consents.listScroll"
          refreshControl={
            <RefreshControl
              refreshing={consents.isRefetching}
              onRefresh={() => void consents.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <PageHeader
            icon="shield"
            title={t.title}
            subtitle={t.subtitle}
            backLabel={t.back}
            onBack={() => navigation.goBack()}
          />
          {body}
        </ScrollView>
      </View>
    );
  };
}

// CfgPrivacidad.html: 16 px side padding, 24 px between blocks, 8 px under a section label, the
// card with radius 20 and 16 px side padding.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, gap: 24 },
    section: { gap: 8 },
    group: { borderRadius: radius.cardLg, paddingVertical: 0, paddingHorizontal: 16 },
    loading: { gap: 12 },
  });
