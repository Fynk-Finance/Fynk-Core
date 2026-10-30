// Conectar banco (ConectarBanco.html, inventory row 29), pushed with the default transition.
// M5 owns the screen and the entity selector; M4's consent cards and authorization are hosted
// here. Once M4 recorded the consent, M5 opens the entity's portal and shows the result.
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ConsentAcceptance,
  ConsentScopeCard,
  scopesOf,
  useConsentText,
  type Consent,
} from '@modules/consents';
import {
  EmptyState,
  ErrorState,
  PrimaryButton,
  Skeleton,
  uiStrings,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { selectedProvider, type BankProvider } from '../domain/provider';
import type { LinkOutcome } from '../application/linkBank';
import type { ProvidersPort } from '../application/ports';
import { useProviders } from '../application/useProviders';
import { ConnectBankHeader } from './ConnectBankHeader';
import { EntitySelector } from './EntitySelector';
import { LinkResult } from './LinkResult';
import { bankStrings } from './strings.es-CO';

const t = bankStrings.connect;
const tl = bankStrings.link;

export interface ConnectBankDeps {
  providers: ProvidersPort;
  /** The link flow (linkBank) for the consent M4 just recorded. */
  link: (input: { provider: string; consentId: string }) => Promise<LinkOutcome>;
}

type Phase =
  | { kind: 'form' }
  | { kind: 'linking'; provider: BankProvider }
  | { kind: 'done'; provider: BankProvider; outcome: Exclude<LinkOutcome, { kind: 'cancelled' }> };

export function createConnectBankScreen({ providers, link }: ConnectBankDeps) {
  return function ConnectBankScreen() {
    const navigation = useNavigation();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const list = useProviders(providers);
    const text = useConsentText();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>({ kind: 'form' });

    const startLink = async (consent: Consent, chosen: BankProvider) => {
      setPhase({ kind: 'linking', provider: chosen });
      const outcome = await link({ provider: chosen.id, consentId: consent.id });
      // A closed browser goes back to the form: the person can choose again.
      setPhase(
        outcome.kind === 'cancelled'
          ? { kind: 'form' }
          : { kind: 'done', provider: chosen, outcome },
      );
    };

    const provider = selectedProvider(list.data ?? [], selectedId);
    const loading = list.isPending || text.isPending;
    const failed = list.isError || text.isError;
    const retry = () => {
      if (list.isError) void list.refetch();
      if (text.isError) void text.refetch();
    };

    let body;
    if (phase.kind === 'linking') {
      const entity = phase.provider.displayName;
      body = (
        <EmptyState icon="bank" title={tl.linking(entity)} message={tl.linkingMessage(entity)} />
      );
    } else if (phase.kind === 'done') {
      body = (
        <LinkResult
          entity={phase.provider.displayName}
          outcome={phase.outcome}
          onRetry={() => setPhase({ kind: 'form' })}
        />
      );
    } else if (failed) {
      body = <ErrorState message={t.error} onRetry={retry} />;
    } else if (loading) {
      body = (
        <View style={styles.skeletons} accessible accessibilityLabel={uiStrings.loading}>
          <Skeleton height={64} radius={16} />
          <Skeleton height={200} radius={18} />
          <Skeleton height={160} radius={18} />
        </View>
      );
    } else if (!provider) {
      body = <EmptyState icon="bank" title={t.empty} message={t.emptyMessage} />;
    } else {
      body = (
        <>
          <EntitySelector
            providers={list.data ?? []}
            selected={provider}
            onSelect={(p) => setSelectedId(p.id)}
          />
          <ConsentScopeCard
            entityName={provider.displayName}
            scopes={scopesOf(provider)}
            text={text.data}
          />
        </>
      );
    }

    return (
      <View style={styles.root} testID="bank.connect">
        <ConnectBankHeader onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
        {phase.kind === 'form' && provider && text.data && !failed ? (
          <View
            style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}
            testID="bank.connect.bottom"
          >
            <ConsentAcceptance
              provider={provider}
              text={text.data}
              onConsentCreated={(consent) => void startLink(consent, provider)}
            />
          </View>
        ) : null}
        {phase.kind === 'done' && phase.outcome.kind === 'linked' ? (
          <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <PrimaryButton
              label={tl.done}
              onPress={() => navigation.goBack()}
              testID="bank.link.done"
            />
          </View>
        ) : null}
      </View>
    );
  };
}

// Sizes from ConectarBanco.html: content padding and gap 16; the bottom bar with a 1 px divider
// on top and 16 px padding.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 16 },
    skeletons: { gap: 16 },
    bottom: {
      paddingTop: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
  });
