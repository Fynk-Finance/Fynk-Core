// Seguridad (CfgSeguridad): change password, the vault module's unlock rows and the linked
// devices. Pushed with the default transition (inventory row 16).
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { RecoveryCodeRow, UnlockSetting } from '@modules/vault';
import type { Clock } from '@shared/domain/types';
import {
  AppText,
  Card,
  ErrorState,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  fonts,
  radius,
  size,
  spacing,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { otherDevices, sessionsLabel } from '../domain/deviceList';
import { relativeTime } from '../domain/relativeTime';
import type { LinkedDevicesApiPort, ProfilePort } from '../application/ports';
import type { ChangePasswordResult } from '../application/sessionService';
import { useLinkedDevices, type DeviceActionResult } from '../application/useLinkedDevices';
import { useProfile } from '../application/useProfile';
import { DeviceRow } from './DeviceRow';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.security;

// M2's approval screen. Navigated by name: identity does not import the vault's screens.
const APPROVE_DEVICE_ROUTE = 'vault.ApproveDevice';

export interface SecurityDeps {
  profile: ProfilePort;
  devices: LinkedDevicesApiPort;
  clock: Clock;
  /** Opens Keycloak's change password page, then moves this device to the new session. */
  changePassword: () => Promise<ChangePasswordResult>;
  deviceId: () => string | null;
  sync: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function createSecurityScreen(deps: SecurityDeps) {
  return function SecurityScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const profile = useProfile(deps.profile, () => void deps.signOut());
    const list = useLinkedDevices({
      api: deps.devices,
      deviceId: deps.deviceId,
      sync: deps.sync,
    });
    const [changing, setChanging] = useState(false);

    const now = deps.clock.now();
    const passwordAgo = profile.data?.passwordUpdatedAt
      ? relativeTime(profile.data.passwordUpdatedAt, now)
      : '';

    const onChangePassword = async () => {
      setChanging(true);
      try {
        const result = await deps.changePassword();
        if (result === 'failed') Alert.alert(t.changeFailed.title, t.changeFailed.message);
        // Keycloak made a new session; the date and the sessions have changed.
        await Promise.all([profile.refetch(), list.refresh()]);
      } finally {
        setChanging(false);
      }
    };

    const alertIfFailed = (result: DeviceActionResult) => {
      if (result === 'failed') Alert.alert(t.actionFailed.title, t.actionFailed.message);
    };

    const confirmClose = (id: string, name: string) =>
      Alert.alert(t.confirmClose.title(name), t.confirmClose.message, [
        { text: t.confirmClose.cancel, style: 'cancel' },
        {
          text: t.confirmClose.confirm,
          style: 'destructive',
          onPress: () => void list.remove(id).then(alertIfFailed),
        },
      ]);

    const confirmCloseAll = () =>
      Alert.alert(t.confirmCloseAll.title, t.confirmCloseAll.message, [
        { text: t.confirmCloseAll.cancel, style: 'cancel' },
        {
          text: t.confirmCloseAll.confirm,
          style: 'destructive',
          onPress: () => void list.signOutOthers().then(alertIfFailed),
        },
      ]);

    const devices = list.query.data;
    // A pending phone cannot close other devices: the API answers 403 device_not_active.
    const thisPending = devices?.some((d) => d.current && d.status === 'pending') ?? false;
    const hasOthers = devices ? otherDevices(devices).length > 0 : false;

    return (
      <Screen scroll padded={false} gap={0} testID="identity.security">
        <View style={styles.content}>
          <View>
            <View style={styles.top}>
              <View style={styles.shield}>
                <Icon name="shield" size={24} color={colors.primaryDark} />
              </View>
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel={t.back}
                testID="identity.security.back"
                style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
              >
                <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
              </Pressable>
            </View>
            <AppText variant="title" accessibilityRole="header">
              {t.title}
            </AppText>
            <AppText variant="body" color="textSecondary" style={styles.subtitle}>
              {t.subtitle}
            </AppText>
          </View>

          <View style={styles.sections}>
            <View style={styles.section}>
              <SectionLabel title={t.password} />
              <Card style={styles.group}>
                <ListRow
                  title={t.changePassword}
                  subtitle={passwordAgo ? `${t.passwordUpdated} ${passwordAgo}` : undefined}
                  icon="security"
                  iconTone="soft"
                  iconSize={40}
                  trailing={
                    changing
                      ? {
                          kind: 'custom',
                          node: <ActivityIndicator size="small" color={colors.primary} />,
                        }
                      : { kind: 'chevron' }
                  }
                  onPress={changing ? undefined : () => void onChangePassword()}
                  accessibilityLabel={
                    passwordAgo
                      ? `${t.changePassword}. ${t.passwordUpdated} ${passwordAgo}`
                      : t.changePassword
                  }
                  testID="identity.security.changePassword"
                />
              </Card>
            </View>

            {/* M2 draws its own "Desbloqueo" section here (placeholders until then). */}
            <UnlockSetting />
            <RecoveryCodeRow />

            <View style={styles.section}>
              <SectionLabel
                title={t.devices}
                meta={devices ? sessionsLabel(devices.length) : undefined}
              />
              {devices ? (
                <>
                  {devices.length > 0 ? (
                    <Card style={styles.group}>
                      {devices.map((device, i) => (
                        <DeviceRow
                          key={device.id}
                          device={device}
                          now={now}
                          divided={i > 0}
                          disabled={list.busy}
                          canClose={!thisPending}
                          // Only an active phone may approve another one (the API says 403 otherwise).
                          onApprove={
                            !thisPending && !device.current && device.status === 'pending'
                              ? () => navigation.navigate(APPROVE_DEVICE_ROUTE)
                              : undefined
                          }
                          onClose={() => confirmClose(device.id, device.name)}
                        />
                      ))}
                    </Card>
                  ) : null}
                  {thisPending ? (
                    <AppText variant="caption" color="textSecondary" style={styles.footer}>
                      {t.pendingHint}
                    </AppText>
                  ) : null}
                  {hasOthers && !thisPending ? (
                    <Pressable
                      onPress={confirmCloseAll}
                      disabled={list.busy}
                      accessibilityRole="button"
                      accessibilityLabel={t.closeAll}
                      testID="identity.security.closeAll"
                      style={({ pressed }) => [styles.closeAll, pressed ? styles.pressed : null]}
                    >
                      <AppText variant="label" color="danger" style={styles.closeAllText}>
                        {t.closeAll}
                      </AppText>
                    </Pressable>
                  ) : null}
                  <AppText variant="caption" color="textSecondary" style={styles.footer}>
                    {t.footer}
                  </AppText>
                </>
              ) : list.query.isError ? (
                // Not in the design: new, needs design review.
                <ErrorState message={t.loadFailed} onRetry={() => void list.query.refetch()} />
              ) : (
                <View accessibilityLabel={uiStrings.loading} style={styles.loading}>
                  <Skeleton height={72} radius={radius.cardLg} />
                  <Skeleton height={72} radius={radius.cardLg} />
                </View>
              )}
            </View>
          </View>
        </View>
      </Screen>
    );
  };
}

function SectionLabel({ title, meta }: { title: string; meta?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.label}>
      <AppText
        variant="caption"
        color="textSecondary"
        accessibilityRole="header"
        style={styles.labelText}
      >
        {title}
      </AppText>
      {meta ? (
        <AppText variant="captionStrong" color="textSecondary">
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.screen - 4, gap: 24 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    shield: {
      width: 56,
      height: 56,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    back: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.input,
      backgroundColor: colors.surfaceBlueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    subtitle: { marginTop: spacing.md, fontSize: 14, lineHeight: 20 },
    sections: { gap: 24 },
    section: { gap: spacing.md },
    label: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    labelText: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    group: { borderRadius: radius.cardLg, paddingVertical: 6, paddingHorizontal: 16 },
    closeAll: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2 },
    closeAllText: { fontFamily: fonts.body.bold },
    footer: { lineHeight: 18 },
    loading: { gap: spacing.xl },
  });
