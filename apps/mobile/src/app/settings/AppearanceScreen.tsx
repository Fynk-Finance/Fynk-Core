// Mi cuenta › Apariencia: the person picks Sistema (follow the phone, the default), Claro or
// Oscuro. The choice applies at once and is kept on the phone (shared contracts 3.6).
// New screen, needs design review: built from the layout of Ajustes de notificaciones (title,
// subtitle, an outlined card with option chips) and the back button of the settings screens.
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  BackButton,
  Card,
  Chip,
  Screen,
  useThemePreference,
  type ThemePreference,
} from '@shared/ui';

import { appearanceStrings as t } from './strings.es-CO';

const OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export function AppearanceScreen() {
  const navigation = useNavigation();
  const [preference, setPreference] = useThemePreference();

  return (
    <Screen scroll testID="appearance-screen">
      <View style={styles.top}>
        <BackButton tone="plain" onPress={() => navigation.goBack()} accessibilityLabel={t.back} />
      </View>
      <View style={styles.heading}>
        <AppText variant="display" accessibilityRole="header">
          {t.title}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t.subtitle}
        </AppText>
      </View>
      <Card>
        <View style={styles.card}>
          <View style={styles.texts}>
            <AppText variant="bodyStrong">{t.themeLabel}</AppText>
            <AppText variant="small" color="textSecondary">
              {t.themeHint}
            </AppText>
          </View>
          <View
            style={styles.options}
            accessibilityRole="radiogroup"
            accessibilityLabel={t.themeLabel}
          >
            {OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t.options[option]}
                selected={preference === option}
                onPress={() => setPreference(option)}
                testID={`appearance-${option}`}
              />
            ))}
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  heading: { gap: 8 },
  card: { gap: 14 },
  texts: { gap: 2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
