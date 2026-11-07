// Screen "Privacidad y datos" (design CfgPrivacidad.html). Pushed with default transition.
// Includes "Uso de tus datos" preferences, embedded "Cuentas conectadas" (<ConnectedAccountsSection />
// from M4), and "Tu información" data export / legal policy actions.
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectedAccountsSection } from '@modules/consents';
import {
  AppText,
  BackButton,
  Card,
  Icon,
  IconTile,
  ListRow,
  Screen,
  Switch,
  fonts,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { complianceStrings } from './strings.es-CO';

const t = complianceStrings.privacy;

export interface PrivacyPreferences {
  aiRecommendations: boolean;
  improveFynk: boolean;
  marketingEmails: boolean;
}

export interface PrivacyScreenDeps {
  ConnectedAccounts?: React.ComponentType;
}

export function createPrivacyScreen({
  ConnectedAccounts = ConnectedAccountsSection,
}: PrivacyScreenDeps = {}) {
  return function PrivacyScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();

    const [prefs, setPrefs] = useState<PrivacyPreferences>({
      aiRecommendations: true,
      improveFynk: true,
      marketingEmails: false,
    });

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.top}>
          <View style={styles.iconTile}>
            <Icon name="eye" size={24} color={colors.primaryDark} />
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

    return (
      <Screen header={header} scroll padded={false} testID="compliance.privacy">
        <View style={styles.content}>
          {/* Section 1: Uso de tus datos */}
          <View style={styles.section}>
            <AppText variant="caption" color="textSecondary" style={styles.sectionTitle}>
              {t.usage.title}
            </AppText>
            <Card style={styles.card}>
              <View style={styles.toggleRow}>
                <IconTile icon="bolt" tone="soft" size={40} />
                <View style={styles.texts}>
                  <AppText variant="bodyStrong">{t.usage.ai.title}</AppText>
                  <AppText variant="small" color="textSecondary">
                    {t.usage.ai.subtitle}
                  </AppText>
                </View>
                <Switch
                  value={prefs.aiRecommendations}
                  onValueChange={(val) => setPrefs((prev) => ({ ...prev, aiRecommendations: val }))}
                  accessibilityLabel={t.usage.ai.title}
                  testID="privacy.switch.ai"
                />
              </View>

              <View style={[styles.toggleRow, styles.divider]}>
                <IconTile icon="chartLine" tone="soft" size={40} />
                <View style={styles.texts}>
                  <AppText variant="bodyStrong">{t.usage.improve.title}</AppText>
                  <AppText variant="small" color="textSecondary">
                    {t.usage.improve.subtitle}
                  </AppText>
                </View>
                <Switch
                  value={prefs.improveFynk}
                  onValueChange={(val) => setPrefs((prev) => ({ ...prev, improveFynk: val }))}
                  accessibilityLabel={t.usage.improve.title}
                  testID="privacy.switch.improve"
                />
              </View>

              <View style={[styles.toggleRow, styles.divider]}>
                <IconTile icon="mail" tone="soft" size={40} />
                <View style={styles.texts}>
                  <AppText variant="bodyStrong">{t.usage.offers.title}</AppText>
                  <AppText variant="small" color="textSecondary">
                    {t.usage.offers.subtitle}
                  </AppText>
                </View>
                <Switch
                  value={prefs.marketingEmails}
                  onValueChange={(val) => setPrefs((prev) => ({ ...prev, marketingEmails: val }))}
                  accessibilityLabel={t.usage.offers.title}
                  testID="privacy.switch.offers"
                />
              </View>
            </Card>
            <AppText variant="small" color="textSecondary">
              {t.usage.footer}
            </AppText>
          </View>

          {/* Section 2: Cuentas conectadas (M4) */}
          <ConnectedAccounts />

          {/* Section 3: Tu información */}
          <View style={styles.section}>
            <AppText variant="caption" color="textSecondary" style={styles.sectionTitle}>
              {t.info.title}
            </AppText>
            <Card style={styles.cardInfo}>
              <ListRow
                title={t.info.download.title}
                subtitle={t.info.download.subtitle}
                icon="arrowDown"
                iconTone="soft"
                iconSize={40}
                trailing={{ kind: 'chevron' }}
                onPress={() => Alert.alert(t.info.download.title, t.info.download.subtitle)}
                testID="privacy.info.download"
              />
              <View style={styles.divider} />
              <ListRow
                title={t.info.policy.title}
                subtitle={t.info.policy.subtitle}
                icon="shield"
                iconTone="soft"
                iconSize={40}
                trailing={{ kind: 'chevron' }}
                onPress={() => Alert.alert(t.info.policy.title, t.info.policy.subtitle)}
                testID="privacy.info.policy"
              />
              <View style={styles.divider} />
              <ListRow
                title={t.info.terms.title}
                subtitle={t.info.terms.subtitle}
                icon="shield"
                iconTone="soft"
                iconSize={40}
                trailing={{ kind: 'chevron' }}
                onPress={() => Alert.alert(t.info.terms.title, t.info.terms.subtitle)}
                testID="privacy.info.terms"
              />
            </Card>
          </View>
        </View>
      </Screen>
    );
  };
}

export const PrivacyScreen = createPrivacyScreen();

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
    iconTile: {
      width: 56,
      height: 56,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtitle: { marginTop: spacing.md },
    content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
    section: { gap: spacing.md },
    sectionTitle: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    card: { borderRadius: radius.cardLg, paddingVertical: 0, paddingHorizontal: 16 },
    cardInfo: { borderRadius: radius.cardLg, paddingVertical: 4, paddingHorizontal: 8 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 16,
    },
    texts: { flexGrow: 1, flexShrink: 1, gap: 2 },
    divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  });
