// Aprobar nuevo dispositivo, the old phone's side of HU-046. Not in the design: new screen, built
// from the design system ("notification card plus primary button"), needs design review.
// It looks for requests every 5 seconds, only while the screen is in front.
import {
  useFocusEffect,
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Clock } from '@shared/domain/types';
import {
  AppText,
  BackButton,
  Card,
  GhostButton,
  PrimaryButton,
  Screen,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { ApproveDeviceService, ApprovalRequestView } from '../application/approveDevice';
import { isApprovalError } from '../application/ports';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.approve;

export const POLL_INTERVAL_MS = 5000;

/** `fromPoll`: the message came from looking for requests, so a later success clears it. */
type Notice = { tone: 'success' | 'error'; text: string; fromPoll?: true };

export interface ApproveDeviceScreenDeps {
  service: ApproveDeviceService;
  clock: Clock;
  /** Route of M1's Seguridad screen, where the linked devices are listed. */
  securityRoute: string;
}

/** "482915" as "482 915". */
export const splitCode = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Whole minutes left, at least 1 while the request is still open. */
export function minutesLeft(expiresAt: string, now: Date): number {
  const ms = Date.parse(expiresAt) - now.getTime();
  return Math.max(1, Math.ceil(ms / 60_000));
}

export function createApproveDeviceScreen({
  service,
  clock,
  securityRoute,
}: ApproveDeviceScreenDeps) {
  return function ApproveDeviceScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const [requests, setRequests] = useState<ApprovalRequestView[] | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const busyRef = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);

    const load = useCallback(async () => {
      // The list must not change under a button that is working.
      if (busyRef.current) return;
      try {
        const list = await service.listPending();
        if (!mounted.current || busyRef.current) return;
        setRequests(list);
        // The connection is back: the offline message from an earlier poll is stale.
        setNotice((n) => (n?.fromPoll ? null : n));
      } catch (e) {
        if (!mounted.current) return;
        setRequests((current) => current ?? []);
        if (isApprovalError(e, 'offline'))
          setNotice({ tone: 'error', text: t.messages.offline, fromPoll: true });
      }
    }, []);

    // Only while the screen is in front: the interval is cleared on blur and on unmount.
    useFocusEffect(
      useCallback(() => {
        void load();
        const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
        return () => clearInterval(timer);
      }, [load]),
    );

    const run = async (id: string, action: () => Promise<Notice | null>) => {
      busyRef.current = true;
      setBusyId(id);
      setNotice(null);
      let next: Notice | null = null;
      try {
        next = await action();
      } finally {
        busyRef.current = false;
        if (mounted.current) {
          setBusyId(null);
          if (next) setNotice(next);
        }
      }
      await load();
    };

    const approve = (request: ApprovalRequestView) =>
      run(request.id, async () => {
        const result = await service.approve(request);
        if (result === 'cancelled') return null;
        if (result === 'approved') return { tone: 'success', text: t.messages.approved };
        return { tone: 'error', text: t.messages[result] };
      });

    const reject = (request: ApprovalRequestView) =>
      run(request.id, async () => {
        const result = await service.reject(request.id);
        if (result === 'rejected') return { tone: 'success', text: t.messages.rejected };
        return { tone: 'error', text: t.messages[result] };
      });

    const now = clock.now();

    return (
      <Screen scroll testID="vault.approve">
        <View style={styles.top}>
          <BackButton
            tone="plain"
            accessibilityLabel={t.back}
            onPress={() => navigation.goBack()}
          />
        </View>
        <View style={styles.heading}>
          <AppText variant="title" accessibilityRole="header">
            {t.title}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {t.subtitle}
          </AppText>
        </View>

        {notice ? (
          <View
            style={[styles.notice, notice.tone === 'error' ? styles.noticeError : null]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="vault.approve.notice"
          >
            <AppText
              variant="smallStrong"
              color={notice.tone === 'error' ? 'danger' : 'primaryDark'}
            >
              {notice.text}
            </AppText>
          </View>
        ) : null}

        {requests?.length === 0 ? (
          <AppText
            variant="body"
            color="textSecondary"
            align="center"
            style={styles.empty}
            testID="vault.approve.empty"
          >
            {t.empty}
          </AppText>
        ) : null}

        {requests?.map((request) => {
          const busy = busyId === request.id;
          const platform = t.platform[request.platform];
          return (
            <Card key={request.id} style={styles.card} testID={`vault.approve.card.${request.id}`}>
              <View accessible accessibilityLabel={`${request.deviceName}. ${platform}`}>
                <AppText variant="cardTitle" numberOfLines={1}>
                  {request.deviceName}
                </AppText>
                <AppText variant="small" color="textSecondary">
                  {platform}
                </AppText>
              </View>
              <View
                style={styles.codeBox}
                accessible
                accessibilityLabel={`${t.codeLabel}. ${request.code.split('').join(' ')}`}
              >
                <AppText
                  variant="display"
                  color="primaryDark"
                  align="center"
                  style={styles.code}
                  testID="vault.approve.code"
                >
                  {splitCode(request.code)}
                </AppText>
                <AppText variant="small" color="textSecondary" align="center">
                  {t.codeLabel}
                </AppText>
              </View>
              <AppText variant="caption" color="textSecondary">
                {t.expiresIn(minutesLeft(request.expiresAt, now))}
              </AppText>
              <PrimaryButton
                label={busy ? t.busy : t.approve}
                onPress={() => void approve(request)}
                disabled={busyId !== null}
                loading={busy}
                accessibilityHint={t.approveHint}
                testID="vault.approve.approve"
              />
              <GhostButton
                label={t.reject}
                onPress={() => void reject(request)}
                disabled={busyId !== null}
                testID="vault.approve.reject"
              />
            </Card>
          );
        })}

        <Pressable
          onPress={() => navigation.navigate(securityRoute)}
          accessibilityRole="link"
          accessibilityLabel={t.devices}
          testID="vault.approve.devices"
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
        >
          <AppText variant="label" color="primary">
            {t.devices}
          </AppText>
        </Pressable>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    top: { flexDirection: 'row' },
    heading: { gap: spacing.md },
    notice: {
      padding: spacing.xl,
      borderRadius: 14,
      backgroundColor: colors.surfaceBlue,
    },
    noticeError: { backgroundColor: colors.dangerSurface },
    empty: { paddingVertical: spacing.section },
    card: { padding: spacing.xl, gap: spacing.xl },
    codeBox: {
      paddingVertical: spacing.xl,
      borderRadius: 14,
      backgroundColor: colors.surfaceBlueSoft,
      gap: spacing.md,
    },
    code: { letterSpacing: 4 },
    link: { alignSelf: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
    pressed: { opacity: 0.7 },
  });
