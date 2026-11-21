// One row of Notificaciones: icon tile, bold title, body, time and the lime unread dot.
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconTile, fonts, radius, spacing, useThemedStyles, type Theme } from '@shared/ui';

import type { InboxItem } from '../domain/inbox';
import { KIND_STYLES } from '../domain/kinds';
import { notificationsStrings } from './strings.es-CO';

export interface NotificationRowProps {
  item: InboxItem;
  time: string;
  onPress: (item: InboxItem) => void;
}

export function NotificationRow({ item, time, onPress }: NotificationRowProps) {
  const styles = useThemedStyles(createStyles);
  const { icon, tone } = KIND_STYLES[item.kind];
  const unread = item.readAt === null;
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="link"
      accessibilityLabel={[
        item.title,
        item.body,
        time,
        unread ? notificationsStrings.inbox.unreadDot : null,
      ]
        .filter(Boolean)
        .join(', ')}
      testID={`notifications.row.${item.id}`}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <IconTile icon={icon} tone={tone} size={40} />
      <View style={styles.text}>
        <View style={styles.top}>
          <AppText variant="label" style={styles.title} numberOfLines={1}>
            {item.title}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="caption" color="textSecondary" style={styles.time}>
              {time}
            </AppText>
            {unread ? (
              <View style={styles.dot} testID={`notifications.row.${item.id}.unread`} />
            ) : null}
          </View>
        </View>
        <AppText variant="small" color="textSecondary">
          {item.body}
        </AppText>
      </View>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
    pressed: { opacity: 0.7 },
    text: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.xs },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    title: { fontFamily: fonts.body.bold, lineHeight: 19, flexShrink: 1 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    time: { fontSize: 11 },
    dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  });
