// Waiting for the old phone to approve this one (HU-046). New screen, needs design review: it uses
// the code box of ApproveDeviceScreen so both phones show the same code the same way.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, GhostButton, spacing, useTheme, useThemedStyles, type Theme } from '@shared/ui';

import { splitCode } from './ApproveDeviceScreen';
import { vaultStrings } from './strings.es-CO';

const t = vaultStrings.restore.approval;

export interface ApprovalWaitingProps {
  /** The 6 digits of this phone's key. */
  code: string;
  /** A poll could not reach the server; it keeps trying. */
  offline: boolean;
  onCancel: () => void;
}

export function ApprovalWaiting({ code, offline, onCancel }: ApprovalWaitingProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} testID="vault.restore.approval">
      <AppText variant="body" color="textSecondary">
        {t.instruction}
      </AppText>
      <View
        style={styles.codeBox}
        accessible
        accessibilityLabel={`${t.codeLabel}. ${code.split('').join(' ')}`}
      >
        <AppText
          variant="display"
          color="primaryDark"
          align="center"
          style={styles.code}
          testID="vault.restore.approvalCode"
        >
          {splitCode(code)}
        </AppText>
      </View>
      <View style={styles.waiting} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <AppText variant="small" color="textSecondary">
          {t.waiting}
        </AppText>
      </View>
      {offline ? (
        <AppText
          variant="caption"
          color="danger"
          align="center"
          accessibilityRole="alert"
          testID="vault.restore.approvalOffline"
        >
          {t.messages.offline}
        </AppText>
      ) : null}
      <GhostButton label={t.cancel} onPress={onCancel} testID="vault.restore.approvalCancel" />
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrap: { gap: spacing.xl },
    codeBox: {
      paddingVertical: spacing.section,
      borderRadius: 14,
      backgroundColor: colors.surfaceBlueSoft,
    },
    code: { letterSpacing: 4 },
    waiting: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
  });
