// Notificaciones (design: Notificaciones, inventory row 8). Pushed with the default transition.
// Hoy, Esta semana and Antes, the unread counter and "Marcar como leídas". Tapping a row marks it
// read and opens its deep link.
import { useNavigation } from '@react-navigation/native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Clock } from '@shared/domain/types';
import {
  AppText,
  BackButton,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  fonts,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { groupInbox, timeLabel, unreadCount, type InboxItem } from '../domain/inbox';
import type { NotificationService } from '../application/notificationService';
import { NotificationRow } from './NotificationRow';
import { notificationsStrings } from './strings.es-CO';
import { useInbox } from './useInbox';

const t = notificationsStrings.inbox;

export interface NotificationsScreenDeps {
  service: NotificationService;
  clock: Clock;
  /** Opens a fynk:// link. Defaults to the OS, which hands it back to the app's linking. */
  openLink?: (url: string) => Promise<unknown>;
}

export function createNotificationsScreen({
  service,
  clock,
  openLink = (url) => Linking.openURL(url),
}: NotificationsScreenDeps) {
  return function NotificationsScreen() {
    const navigation = useNavigation();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const { state, reload } = useInbox(service);

    const items = state.status === 'ready' ? state.items : [];
    const unread = unreadCount(items);
    const now = clock.now();

    const onPressRow = async (item: InboxItem) => {
      if (item.readAt === null) await service.markRead(item.id);
      await openLink(item.deepLink).catch(() => undefined);
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <View style={styles.heading}>
          <AppText variant="screenTitle" accessibilityRole="header">
            {t.title}
          </AppText>
          {items.length > 0 ? (
            <View style={styles.counterRow}>
              <AppText
                variant="small"
                color="textSecondary"
                accessibilityLiveRegion="polite"
                testID="notifications.unreadCount"
              >
                {t.unread(unread)}
              </AppText>
              {unread > 0 ? (
                <Pressable
                  onPress={() => void service.markAllRead()}
                  accessibilityRole="button"
                  hitSlop={8}
                  testID="notifications.markAllRead"
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <AppText variant="smallStrong" color="link">
                    {t.markAllRead}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );

    return (
      <Screen header={header} scroll padded={false} gap={16} testID="notifications.inbox">
        <View style={styles.content}>
          {state.status === 'loading' ? (
            <View style={styles.section}>
              <Skeleton width={80} height={12} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : state.status === 'error' ? (
            <ErrorState message={t.error} onRetry={() => void reload()} />
          ) : items.length === 0 ? (
            <EmptyState title={t.empty} icon="bell" />
          ) : (
            groupInbox(items, now).map((section) => (
              <View
                key={section.key}
                style={styles.section}
                testID={`notifications.section.${section.key}`}
              >
                <AppText
                  variant="caption"
                  color="textSecondary"
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                >
                  {t.sections[section.key]}
                </AppText>
                <View style={styles.rows}>
                  {section.items.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      time={timeLabel(item.createdAt, now)}
                      onPress={(i) => void onPressRow(i)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    heading: { gap: spacing.xs },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    pressed: { opacity: 0.6 },
    content: { paddingHorizontal: 16, paddingBottom: 16, gap: 16 },
    section: { gap: spacing.md },
    sectionTitle: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    rows: { gap: spacing.md },
  });
