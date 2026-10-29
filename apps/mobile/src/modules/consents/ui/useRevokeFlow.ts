// The revoke flow shared by the detail and "Cuentas conectadas" (HU-008): a clear confirmation,
// then the identity check M1 or M2 install (none yet), then the revocation, then the M4 prompt's
// "Fynk ya no recibirá datos de <Entidad>."
import { useState } from 'react';
import { Alert } from 'react-native';

import { isApiError } from '@shared/api';

import type { Consent } from '../domain/consent';
import type { Revocation } from '../application/revocation';
import { useRevokeConsent } from '../application/useConsents';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings.revoke;

export type RevokeOutcome = { kind: 'revoked' | 'error'; message: string } | null;

const confirm = (entity: string) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      t.confirmTitle(entity),
      t.confirmMessage(entity),
      [
        { text: t.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: t.confirm, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

function errorMessage(e: unknown): string {
  if (isApiError(e) && e.code === 'consent_not_revocable') return t.errors.ended;
  if (isApiError(e) && e.code === 'network_error') return t.errors.network;
  return t.errors.unknown;
}

export function useRevokeFlow(revocation: Revocation) {
  const mutation = useRevokeConsent(revocation);
  const [outcome, setOutcome] = useState<RevokeOutcome>(null);

  const start = async (consent: Pick<Consent, 'id'>, entity: string) => {
    setOutcome(null);
    if (!(await confirm(entity))) return;
    if (!(await revocation.checkIdentity({ reason: 'revoke_consent', entity }))) return;
    try {
      await mutation.mutateAsync(consent.id);
      setOutcome({ kind: 'revoked', message: t.done(entity) });
    } catch (e) {
      setOutcome({ kind: 'error', message: errorMessage(e) });
    }
  };

  return { start, isPending: mutation.isPending, outcome };
}
