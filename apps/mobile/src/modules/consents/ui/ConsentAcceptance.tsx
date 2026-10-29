// The bottom of Conectar banco (ConectarBanco.html): the authorization checkbox and the
// "Ir al portal de <Entidad>" button, disabled until the box is checked. The button records the
// consent (POST /consents) and hands it to the host (M5), which opens the entity's portal.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, PrimaryButton } from '@shared/ui';

import {
  canGoToPortal,
  type Consent,
  type ConsentProvider,
  type ConsentText,
} from '../domain/consent';
import { errorKindOf, useCreateConsent } from '../application/createConsent';
import type { ConsentsDeps } from '../application/ports';
import { ConsentCheckbox } from './ConsentCheckbox';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings;

export interface ConsentAcceptanceProps {
  provider: ConsentProvider | undefined;
  /** The text shown on the screen; undefined while it loads. */
  text: ConsentText | undefined;
  /** Called with the pending consent; the host continues to the entity's portal. */
  onConsentCreated: (consent: Consent) => void;
  onPressPolicy?: () => void;
}

export function createConsentAcceptance(deps: ConsentsDeps) {
  return function ConsentAcceptance({
    provider,
    text,
    onConsentCreated,
    onPressPolicy,
  }: ConsentAcceptanceProps) {
    const [accepted, setAccepted] = useState(false);
    const create = useCreateConsent(deps);
    const { errorKind, reset } = create;

    // A new entity or a new text needs a new, explicit acceptance. A new text keeps the message
    // that explains why the box was cleared.
    const textId = text ? `${text.version}|${text.sha256}` : null;
    useEffect(() => {
      setAccepted(false);
      reset();
    }, [provider?.id, reset]);
    useEffect(() => setAccepted(false), [textId]);

    const onPress = async () => {
      if (!provider || !text) return;
      try {
        onConsentCreated(await create.submit({ provider, text }));
      } catch (e) {
        // The message comes from create.errorKind.
        if (errorKindOf(e) === 'text_changed') setAccepted(false);
      }
    };

    const entity = provider?.displayName ?? '';
    return (
      <View style={styles.container}>
        <ConsentCheckbox
          checked={accepted}
          onChange={setAccepted}
          onPressPolicy={onPressPolicy}
          disabled={create.isPending}
        />
        {errorKind ? (
          <AppText
            variant="caption"
            color="danger"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="consents.error"
          >
            {t.errors[errorKind]}
          </AppText>
        ) : null}
        <PrimaryButton
          label={t.goToPortal(entity)}
          accessibilityHint={t.goToPortalHint}
          disabled={!canGoToPortal({ accepted, text, provider, submitting: create.isPending })}
          loading={create.isPending}
          onPress={() => void onPress()}
          testID="consents.goToPortal"
        />
      </View>
    );
  };
}

const styles = StyleSheet.create({ container: { gap: 8 } });
