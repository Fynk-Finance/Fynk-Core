// The consent cards of Conectar banco (ConectarBanco.html): "<Entidad> compartirá con Fynk" with
// one row per scope, then "Fynk nunca podrá" and its footer. The purpose and term line under the
// scopes is new (M04 prompt) and reuses the footer style: needs design review.
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText, Card, Icon, radius, useTheme, useThemedStyles, type Theme } from '@shared/ui';

import { purposeAndTerm, type ConsentScope, type ConsentText } from '../domain/consent';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings.scopeCard;

// Icons of the three rows, copied from the design. They are not in the shared icon set yet.
const SCOPE_ICON: Record<ConsentScope, string> = {
  balances: 'M2 6h20v12H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
  transactions: 'M3 6h18M3 12h18M3 18h12',
  account_details: 'M3 5h18v14H3zM7 9h6M7 13h10',
};

export interface ConsentScopeCardProps {
  /** The entity's display name, from M5's provider list. */
  entityName: string;
  scopes: readonly ConsentScope[];
  /** When given, the purpose and the term of the published text are shown. */
  text?: Pick<ConsentText, 'purpose' | 'termDays'>;
}

export function ConsentScopeCard({ entityName, scopes, text }: ConsentScopeCardProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <Card style={styles.card} testID="consents.scopeCard">
        <AppText variant="headerTitle" accessibilityRole="header">
          {t.shares(entityName)}
        </AppText>
        <View style={styles.list}>
          {scopes.map((scope) => (
            <View key={scope} style={styles.scopeRow} testID={`consents.scope.${scope}`}>
              <View style={styles.scopeTile}>
                <Svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.primaryDark}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d={SCOPE_ICON[scope]} />
                </Svg>
              </View>
              <View style={styles.scopeText}>
                <AppText variant="label" style={styles.scopeTitle}>
                  {t.scopes[scope].title}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t.scopes[scope].detail}
                </AppText>
              </View>
            </View>
          ))}
        </View>
        {text ? (
          <AppText
            variant="caption"
            color="textSecondary"
            style={styles.footer}
            testID="consents.purposeAndTerm"
          >
            {purposeAndTerm(text)}
          </AppText>
        ) : null}
      </Card>

      <Card style={styles.card} testID="consents.neverCard">
        <AppText variant="headerTitle" accessibilityRole="header">
          {t.never}
        </AppText>
        <View style={styles.list}>
          {t.neverItems.map((item) => (
            <View key={item} style={styles.neverRow}>
              <View style={styles.neverTile}>
                <Icon name="close" size={12} color={colors.danger} strokeWidth={3} />
              </View>
              <AppText variant="small" style={styles.neverText}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" color="textSecondary" style={styles.footer}>
          {t.footer}
        </AppText>
      </Card>
    </View>
  );
}

// Sizes from ConectarBanco.html: cards with 16 padding and 8 gap, 32/10 scope tiles, 24/7 tiles.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    stack: { gap: 16 },
    card: { padding: 16, gap: 8 },
    list: { gap: 8 },
    scopeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    scopeTile: {
      width: 32,
      height: 32,
      borderRadius: radius.tileSm,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeText: { flex: 1, gap: 1 },
    scopeTitle: { lineHeight: 19 },
    neverRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    neverTile: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: colors.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    neverText: { flex: 1 },
    footer: {
      marginTop: 2,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      lineHeight: 18,
    },
  });
