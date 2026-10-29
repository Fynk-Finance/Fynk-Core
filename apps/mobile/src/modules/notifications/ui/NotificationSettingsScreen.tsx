// Mi cuenta › Notificaciones (design CfgNotificaciones, inventory row 17). Pushed with the default
// transition. "Permitir notificaciones", one switch per kind of notice, and when to remind a
// payment. Rows not in the design (price increases, sync, caps, new devices) need design review.
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NotificationKind } from '@shared/ports';
import {
  AppText,
  BackButton,
  Card,
  Chip,
  ErrorState,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  Switch,
  fonts,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import {
  PAYMENT_LEAD_DAYS,
  SETTINGS_SECTIONS,
  rowEnabled,
  type PaymentLeadDays,
  type SettingsRow,
} from '../domain/settings';
import type { NotificationService, NotificationSettings } from '../application/notificationService';
import { notificationsStrings } from './strings.es-CO';

const t = notificationsStrings.settings;

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; s: NotificationSettings };

export function createNotificationSettingsScreen({ service }: { service: NotificationService }) {
  return function NotificationSettingsScreen() {
    const navigation = useNavigation();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [state, setState] = useState<State>({ status: 'loading' });

    const load = useCallback(async () => {
      try {
        setState({ status: 'ready', s: await service.settings() });
      } catch {
        setState({ status: 'error' });
      }
    }, []);

    useEffect(() => {
      void load();
    }, [load]);

    /** Shows the change at once, saves it, and reloads the truth if saving fails. */
    const change = (next: NotificationSettings, save: () => Promise<void>) => {
      setState({ status: 'ready', s: next });
      save().catch(() => void load());
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.top}>
          <View style={styles.bell}>
            <Icon name="bell" size={24} color={colors.primaryDark} />
          </View>
          <BackButton
            tone="plain"
            accessibilityLabel={t.back}
            onPress={() => navigation.goBack()}
          />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {t.title}
        </AppText>
        <AppText variant="subtitle" color="textSecondary" style={styles.subtitle}>
          {t.subtitle}
        </AppText>
      </View>
    );

    if (state.status !== 'ready') {
      return (
        <Screen header={header} scroll padded={false} testID="notifications.settings">
          <View style={styles.content}>
            {state.status === 'loading' ? (
              <>
                <Skeleton height={72} radius={radius.cardLg} />
                <Skeleton height={200} radius={radius.cardLg} />
              </>
            ) : (
              <ErrorState message={t.error} onRetry={() => void load()} />
            )}
          </View>
        </Screen>
      );
    }

    const s = state.s;
    const isOn = (kind: NotificationKind) => s.kinds[kind];

    const toggleRow = (row: SettingsRow, on: boolean) => {
      const kinds = { ...s.kinds };
      for (const kind of row.kinds) kinds[kind] = on;
      change({ ...s, kinds }, async () => {
        for (const kind of row.kinds) await service.setEnabled(kind, on);
      });
    };

    const setLead = (days: PaymentLeadDays) =>
      change({ ...s, paymentLeadDays: days }, () => service.setPaymentLeadDays(days));

    return (
      <Screen header={header} scroll padded={false} testID="notifications.settings">
        <View style={styles.content}>
          <Card variant="soft">
            <View style={styles.allowAll}>
              <View style={styles.texts}>
                <AppText variant="bodyStrong" style={styles.bold}>
                  {t.allowAll.title}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t.allowAll.subtitle}
                </AppText>
              </View>
              <Switch
                value={s.allowAll}
                onValueChange={(on) =>
                  change({ ...s, allowAll: on }, () => service.setAllowAll(on))
                }
                accessibilityLabel={t.allowAll.title}
                testID="notifications.settings.allowAll"
              />
            </View>
          </Card>

          <View
            style={[styles.sections, s.allowAll ? null : styles.muted]}
            pointerEvents={s.allowAll ? 'auto' : 'none'}
            accessibilityElementsHidden={!s.allowAll}
            importantForAccessibility={s.allowAll ? 'auto' : 'no-hide-descendants'}
          >
            {SETTINGS_SECTIONS.map((section) => (
              <View key={section.key} style={styles.section}>
                <AppText
                  variant="caption"
                  color="textSecondary"
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                >
                  {t.sections[section.key]}
                </AppText>
                <Card style={styles.group}>
                  {section.rows.map((row, i) => {
                    const copy = t.rows[row.key];
                    const on = rowEnabled(row, isOn);
                    return (
                      <View key={row.key} style={i > 0 ? styles.divided : null}>
                        <ListRow
                          title={copy.title}
                          subtitle={copy.subtitle}
                          icon={row.icon}
                          iconTone="soft"
                          iconSize={40}
                          testID={`notifications.settings.row.${row.key}`}
                          trailing={{
                            kind: 'custom',
                            node: (
                              <Switch
                                value={on}
                                disabled={row.locked}
                                onValueChange={(next) => toggleRow(row, next)}
                                accessibilityLabel={copy.title}
                                testID={`notifications.settings.${row.key}`}
                              />
                            ),
                          }}
                        />
                        {row.key === 'payments' && on ? (
                          <View
                            style={styles.chips}
                            accessibilityRole="radiogroup"
                            accessibilityLabel={t.leadDays.label}
                          >
                            {PAYMENT_LEAD_DAYS.map((days) => (
                              <Chip
                                key={days}
                                label={t.leadDays.options[days]}
                                selected={s.paymentLeadDays === days}
                                onPress={() => setLead(days)}
                                testID={`notifications.settings.lead.${days}`}
                              />
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))}
          </View>
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, backgroundColor: colors.background },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 16,
      paddingBottom: 16,
    },
    bell: {
      width: 56,
      height: 56,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtitle: { marginTop: spacing.md },
    content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
    allowAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    texts: { flexGrow: 1, flexShrink: 1, gap: 2 },
    bold: { fontFamily: fonts.body.bold },
    sections: { gap: 24 },
    muted: { opacity: 0.4 },
    section: { gap: spacing.md },
    sectionTitle: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    group: { borderRadius: radius.cardLg, paddingVertical: 0, paddingHorizontal: 16 },
    divided: { borderTopWidth: 1, borderTopColor: colors.divider },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      paddingLeft: 48,
      paddingBottom: 16,
    },
  });
