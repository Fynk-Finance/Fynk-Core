// "Detectamos 2 pagos recurrentes · Revisar" in Billetera, above "Gastos recurrentes", while
// detection has proposals waiting for the person (SCRUM-55). New element, needs design review:
// a soft card from the shared kit.
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, IconTile, spacing, useTheme, useThemedStyles } from '@shared/ui';

import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.detected;

export function DetectedBanner({ count, onPress }: { count: number; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Card
      variant="soft"
      onPress={onPress}
      accessibilityLabel={`${t.banner(count)}, ${t.bannerAction}`}
      testID="recurring.billetera.detected"
    >
      <View style={styles.row}>
        <IconTile icon="sync" tone="accent" size={40} />
        <AppText variant="bodyStrong" style={styles.text}>
          {t.banner(count)}
        </AppText>
        <AppText variant="label" color="primary">
          {t.bannerAction}
        </AppText>
        <Icon name="chevronRight" size={18} color={colors.primary} />
      </View>
    </Card>
  );
}

const createStyles = () =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    text: { flexGrow: 1, flexShrink: 1 },
  });
