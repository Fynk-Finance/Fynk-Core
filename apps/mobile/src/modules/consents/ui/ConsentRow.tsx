// One consent, as a row of "Cuentas conectadas" (CfgPrivacidad.html): the 40/12 tile, the entity
// name with its status chip, the dates, and on the right either a chevron (opens the detail) or
// the red "Revocar" chip of the design.
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Icon,
  IconTile,
  fonts,
  useTheme,
  useThemedStyles,
  type BadgeTone,
  type Theme,
} from '@shared/ui';

import type { Consent, ConsentStatus } from '../domain/consent';
import { shortDate } from '../domain/consentList';
import { consentsStrings } from './strings.es-CO';

const t = consentsStrings;

const TONE: Record<ConsentStatus, BadgeTone> = {
  active: 'success',
  pending: 'info',
  revoked: 'neutral',
  expired: 'neutral',
  failed: 'neutral',
};

export function StatusChip({ status }: { status: ConsentStatus }) {
  return (
    <Badge label={t.status[status]} tone={TONE[status]} testID={`consents.status.${status}`} />
  );
}

/** "Otorgado el 3 sep 2026" (or "Solicitado el" while pending), then the end or the revocation. */
export function dateLines(consent: Consent, status: ConsentStatus): string[] {
  const lines = [
    consent.grantedAt
      ? t.dates.granted(shortDate(consent.grantedAt))
      : t.dates.requested(shortDate(consent.createdAt)),
  ];
  if (status === 'revoked' && consent.revokedAt)
    lines.push(t.dates.revoked(shortDate(consent.revokedAt)));
  else if (consent.expiresAt) {
    const end = shortDate(consent.expiresAt);
    lines.push(status === 'expired' ? t.dates.expired(end) : t.dates.expires(end));
  }
  return lines;
}

export interface ConsentRowProps {
  consent: Consent;
  /** Status as of now (`statusAt`). */
  status: ConsentStatus;
  entity: string;
  first?: boolean;
  onOpen?: () => void;
  /** Shows the "Revocar" chip instead of the chevron. */
  onRevoke?: () => void;
}

export function ConsentRow({
  consent,
  status,
  entity,
  first = false,
  onOpen,
  onRevoke,
}: ConsentRowProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const lines = dateLines(consent, status);
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={[entity, t.status[status], ...lines].join(', ')}
      accessibilityHint={onOpen ? t.list.openHint : undefined}
      style={({ pressed }) => [
        styles.row,
        first ? null : styles.divided,
        pressed && onOpen ? styles.pressed : null,
      ]}
      testID={`consents.row.${consent.id}`}
    >
      <IconTile icon="bank" tone="soft" size={40} />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {entity}
          </AppText>
          <StatusChip status={status} />
        </View>
        {lines.map((line) => (
          <AppText key={line} variant="caption" color="textSecondary" style={styles.line}>
            {line}
          </AppText>
        ))}
      </View>
      {onRevoke ? (
        <Pressable
          onPress={onRevoke}
          accessibilityRole="button"
          accessibilityLabel={`${t.revoke.chip} ${entity}`}
          style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
          testID={`consents.row.${consent.id}.revoke`}
        >
          <AppText variant="smallStrong" color="danger" style={styles.chipText}>
            {t.revoke.chip}
          </AppText>
        </Pressable>
      ) : onOpen ? (
        <Icon name="chevronRight" size={16} strokeWidth={2.2} color={colors.textPlaceholder} />
      ) : null}
    </Pressable>
  );
}

// Sizes from CfgPrivacidad.html: rows 16 px high padding with a divider between them, names 15/20,
// dates 12/17, the "Revocar" chip 32 high with radius 11 and a 1.5 px red border.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
    divided: { borderTopWidth: 1, borderTopColor: colors.divider },
    pressed: { opacity: 0.7 },
    texts: { flex: 1, gap: 2, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flexShrink: 1 },
    line: { lineHeight: 17 },
    chip: {
      height: 32,
      paddingHorizontal: 8,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
      justifyContent: 'center',
    },
    chipText: { fontFamily: fonts.body.bold },
  });
