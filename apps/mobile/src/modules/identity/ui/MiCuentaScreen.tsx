// Mi cuenta (DetalleCuentas): header, "Información Básica" and the "Gestión de cuenta" rows of
// this module (miCuentaRows.ts). Pushed with the default transition (inventory row 7).
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  ErrorState,
  IconTile,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  radius,
  spacing,
  uiStrings,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { memberSince, type Profile } from '../domain/profile';
import type { ProfilePort } from '../application/ports';
import { useProfile } from '../application/useProfile';
import { MiCuentaHeader } from './MiCuentaHeader';
import { miCuentaRows, type MiCuentaRow } from './miCuentaRows';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.miCuenta;

export interface MiCuentaDeps {
  profile: ProfilePort;
  signOut: () => Promise<void>;
}

export function createMiCuentaScreen({ profile: port, signOut }: MiCuentaDeps) {
  return function MiCuentaScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const query = useProfile(port, () => void signOut());

    const confirmSignOut = () =>
      Alert.alert(t.signOutConfirm.title, t.signOutConfirm.message, [
        { text: t.signOutConfirm.cancel, style: 'cancel' },
        { text: t.signOutConfirm.confirm, style: 'destructive', onPress: () => void signOut() },
      ]);

    const onRow = (row: MiCuentaRow) => {
      if (row.target.kind === 'signOut') confirmSignOut();
      else navigation.navigate(row.target.route);
    };

    const profile = query.data;
    return (
      <Screen
        scroll
        padded={false}
        testID="identity.miCuenta"
        header={<MiCuentaHeader profile={profile} onBack={() => navigation.goBack()} />}
      >
        <View style={styles.content}>
          {profile ? (
            <>
              <SectionHeader title={t.basicInfo} />
              <BasicInfo profile={profile} />
              <SectionHeader title={t.management} />
              <View style={styles.rows}>
                {miCuentaRows.map((row) => (
                  <ListRow
                    key={row.id}
                    title={row.title}
                    subtitle={row.subtitle}
                    icon={row.icon}
                    iconTone="soft"
                    iconSize={40}
                    trailing={{ kind: 'chevron' }}
                    onPress={() => onRow(row)}
                    accessibilityLabel={`${row.title}. ${row.subtitle}`}
                    testID={`identity.miCuenta.row.${row.id}`}
                  />
                ))}
              </View>
            </>
          ) : query.isError ? (
            // Not in the design: new, needs design review.
            <ErrorState message={t.retryFailed} onRetry={() => void query.refetch()} />
          ) : (
            <View accessibilityLabel={uiStrings.loading} style={styles.loading}>
              <Skeleton height={26} width="60%" />
              <Skeleton height={120} radius={radius.cardLg} />
              <Skeleton height={26} width="60%" />
              <Skeleton height={200} radius={radius.cardLg} />
            </View>
          )}
        </View>
      </Screen>
    );
  };
}

function BasicInfo({ profile }: { profile: Profile }) {
  const styles = useThemedStyles(createStyles);
  const items = [
    { icon: 'mail', label: t.recoveryEmail, value: profile.email },
    { icon: 'calendar', label: t.memberSince, value: memberSince(profile.createdAt) },
  ] as const;
  return (
    <Card style={styles.info}>
      {items.map((item, i) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
          style={[styles.infoRow, i > 0 ? styles.divided : null]}
        >
          <IconTile icon={item.icon} tone="soft" size={32} />
          <View style={styles.infoTexts}>
            <AppText variant="caption" color="textSecondary">
              {item.label}
            </AppText>
            <AppText variant="label">{item.value}</AppText>
          </View>
        </View>
      ))}
    </Card>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: spacing.screen - 4, gap: spacing.md },
    loading: { gap: spacing.xl },
    info: { paddingVertical: spacing.md, paddingHorizontal: 16, borderRadius: radius.cardLg },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
    divided: { borderTopWidth: 1, borderTopColor: colors.divider },
    infoTexts: { flex: 1, minWidth: 0, gap: 1 },
    rows: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radius.cardLg,
      backgroundColor: colors.background,
      ...shadow.card,
    },
  });
