// The identity gate's flow: a loader while the stored session is read, then Inicio.
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@shared/ui';

import type { SessionService } from '../application/sessionService';
import { InicioScreen } from './InicioScreen';
import { identityStrings } from './strings.es-CO';
import { useSessionState } from './useSessionState';

export function createIdentityFlow(session: SessionService) {
  return function IdentityFlow() {
    const state = useSessionState(session);
    useEffect(() => {
      void session.restore();
    }, []);

    if (state.status === 'restoring') {
      return (
        <View style={styles.loading} testID="identity.restoring">
          <ActivityIndicator
            color={colors.primary}
            accessibilityLabel={identityStrings.restoring}
          />
        </View>
      );
    }
    return (
      <InicioScreen
        state={state}
        onStart={() => void session.signUp()}
        onSignIn={() => void session.signIn()}
      />
    );
  };
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
