// One linked device of Seguridad: icon tile, name, last activity and either the "Este dispositivo"
// pill or the "Cerrar" button. The design shows a place ("Bogotá ·"); none is stored, so none shows.
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, IconTile, fonts, radius, useThemedStyles, type Theme } from '@shared/ui';

import type { LinkedDeviceItem } from '../domain/deviceList';
import { JUST_NOW, relativeTime } from '../domain/relativeTime';
import { identityStrings } from './strings.es-CO';

const t = identityStrings.security;

/** "Activo ahora" or "Hace 2 días". Empty when the date is unknown. */
function lastSeenText(device: LinkedDeviceItem, now: Date): string {
  // This phone just asked for the list, so it is active whatever its stored time says.
  if (device.current) return t.activeNow;
  const ago = relativeTime(device.lastSeenAt, now);
  if (ago === JUST_NOW) return t.activeNow;
  return ago ? ago.charAt(0).toUpperCase() + ago.slice(1) : '';
}

export interface DeviceRowProps {
  device: LinkedDeviceItem;
  now: Date;
  /** Draws the line between rows. */
  divided: boolean;
  disabled: boolean;
  /** False while this phone waits for approval: the API refuses it to close other devices. */
  canClose: boolean;
  onClose: () => void;
}

export function DeviceRow({ device, now, divided, disabled, canClose, onClose }: DeviceRowProps) {
  const styles = useThemedStyles(createStyles);
  const seen = lastSeenText(device, now);
  const pending = device.status === 'pending';
  const label = [
    device.name,
    seen,
    device.current ? t.thisDevice : null,
    pending ? t.pending : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={[styles.row, divided ? styles.divided : null]}
      testID={`identity.security.device.${device.id}`}
    >
      <View accessible accessibilityLabel={label} style={styles.info}>
        <IconTile icon="phone" tone={device.current ? 'accent' : 'soft'} size={40} />
        <View style={styles.texts}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {device.name}
          </AppText>
          {seen ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {seen}
            </AppText>
          ) : null}
        </View>
      </View>
      {device.current ? (
        <View style={styles.thisDevice}>
          <AppText variant="overline" style={styles.thisDeviceText}>
            {t.thisDevice}
          </AppText>
        </View>
      ) : (
        <>
          {pending ? <Badge tone="neutral" size="lg" label={t.pending} /> : null}
          {canClose ? (
            <Pressable
              onPress={onClose}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={t.closeDevice(device.name)}
              testID={`identity.security.device.${device.id}.close`}
              style={({ pressed }) => [
                styles.close,
                pressed || disabled ? styles.closePressed : null,
              ]}
            >
              <AppText variant="small" color="danger" style={styles.closeText}>
                {t.close}
              </AppText>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    divided: { borderTopWidth: 1, borderTopColor: colors.divider },
    info: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    texts: { flex: 1, minWidth: 0, gap: 2 },
    // The design's pill: accent tint with the accent text color (Badge "success" uses another green).
    thisDevice: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentTint,
    },
    thisDeviceText: { color: colors.accentText, letterSpacing: 0, textTransform: 'none' },
    close: {
      height: 32,
      paddingHorizontal: 8,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closePressed: { opacity: 0.6 },
    closeText: { fontFamily: fonts.body.bold },
  });
