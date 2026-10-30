// Restore on a new phone (HU-045). New screen, needs design review: it uses the title block of
// RecoveryCodeScreen, the option card style of OnbListo.html and the field of OnbCorreo.html
// (56 px, 1.5 px blue border, IBM Plex Mono). The 26 characters go in one field, not in boxes.
// The code is only in this screen's state and in the call to onRestore: never stored or logged.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Card,
  GhostButton,
  IconTile,
  ListRow,
  PrimaryButton,
  Screen,
  fonts,
  radius,
  size,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { ApprovalCheck, ApprovalStart } from '../application/restoreWithApproval';
import type { RestoreFailure } from '../application/restoreWithCode';
import { ApprovalWaiting } from './ApprovalWaiting';
import { vaultStrings } from './strings.es-CO';
import { useApprovalRestore } from './useApprovalRestore';

const t = vaultStrings.restore;

export interface RestoreScreenProps {
  /** True while the restore runs: the form is replaced by the spinner. */
  restoring: boolean;
  /** Why the last try did not work. */
  error?: RestoreFailure;
  /**
   * `pending`: the old phone can approve this one. `active`: the server refuses an approval, so
   * the option is hidden and only the recovery code is left.
   */
  deviceStatus: 'pending' | 'active';
  onRestore: (typed: string) => void;
  /** Asks the old phone. The screen polls `onCheckApproval` while it waits. */
  onStartApproval: () => Promise<ApprovalStart>;
  onCheckApproval: (id: string) => Promise<ApprovalCheck>;
  onSignOut: () => void;
}

export function RestoreScreen({
  restoring,
  error,
  deviceStatus,
  onRestore,
  onStartApproval,
  onCheckApproval,
  onSignOut,
}: RestoreScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [codeOpen, setCodeOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [focused, setFocused] = useState(false);
  // The error belongs to the code that was typed: editing it clears the message.
  const [dismissed, setDismissed] = useState(false);
  const shownError = error && !dismissed ? error : null;
  const approval = useApprovalRestore({
    restoring,
    onStart: onStartApproval,
    onCheck: onCheckApproval,
  });

  const submit = () => {
    if (typed.trim() === '') return;
    setDismissed(false);
    onRestore(typed);
  };

  return (
    <Screen scroll gap={spacing.section} testID="vault.restore">
      <View style={styles.titles}>
        <IconTile icon="phone" tone="soft" size={72} />
        <AppText variant="title" accessibilityRole="header">
          {t.title}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t.message}
        </AppText>
      </View>

      {restoring ? (
        <View style={styles.center} testID="vault.restore.restoring">
          <ActivityIndicator color={colors.primary} accessibilityLabel={t.restoring} />
          <AppText variant="small" color="textSecondary" align="center">
            {t.restoring}
          </AppText>
        </View>
      ) : approval.starting ? (
        <View style={styles.center} testID="vault.restore.starting">
          <ActivityIndicator color={colors.primary} accessibilityLabel={t.approval.starting} />
          <AppText variant="small" color="textSecondary" align="center">
            {t.approval.starting}
          </AppText>
        </View>
      ) : approval.request ? (
        <ApprovalWaiting
          code={approval.request.code}
          offline={approval.offline}
          onCancel={approval.cancel}
        />
      ) : (
        <>
          {approval.message ? (
            <View style={styles.notice} testID="vault.restore.approvalMessage">
              <AppText
                variant="smallStrong"
                color="danger"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {t.approval.messages[approval.message]}
              </AppText>
              {approval.message === 'rejected' || approval.message === 'expired' ? (
                <GhostButton
                  label={t.approval.retry}
                  onPress={() => void approval.begin()}
                  testID="vault.restore.approvalRetry"
                />
              ) : null}
            </View>
          ) : null}
          <Card>
            <ListRow
              title={t.codeOption}
              icon="lock"
              trailing={{ kind: 'chevron' }}
              onPress={() => setCodeOpen(true)}
              accessibilityLabel={t.codeOption}
              testID="vault.restore.codeOption"
            />
          </Card>
          {deviceStatus === 'pending' ? (
            <Card>
              <ListRow
                title={t.approvalOption}
                icon="phone"
                trailing={{ kind: 'chevron' }}
                onPress={() => void approval.begin()}
                accessibilityLabel={t.approvalOption}
                testID="vault.restore.approvalOption"
              />
            </Card>
          ) : null}
          {/* Next branch (SCRUM-63): the option "No tengo ninguno de los dos" goes here. */}

          {codeOpen ? (
            <View style={styles.form}>
              <View style={styles.field}>
                <AppText variant="label">{t.inputLabel}</AppText>
                <TextInput
                  value={typed}
                  onChangeText={(text) => {
                    setTyped(text);
                    setDismissed(true);
                  }}
                  placeholder={t.inputPlaceholder}
                  placeholderTextColor={colors.textPlaceholder}
                  selectionColor={colors.primary}
                  // Groups and spaces are fine; 40 leaves room for them.
                  maxLength={40}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  accessibilityLabel={t.inputLabel}
                  accessibilityHint={t.codeOptionHint}
                  style={[
                    styles.input,
                    focused ? styles.inputFocused : null,
                    shownError ? styles.inputError : null,
                  ]}
                  testID="vault.restore.codeInput"
                />
                {shownError ? (
                  <AppText
                    variant="caption"
                    color="danger"
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    testID="vault.restore.error"
                  >
                    {t.errors[shownError]}
                  </AppText>
                ) : null}
              </View>
              <PrimaryButton
                label={t.submit}
                onPress={submit}
                disabled={typed.trim() === ''}
                testID="vault.restore.submit"
              />
            </View>
          ) : null}
        </>
      )}

      {/* A person is never stuck on this screen. */}
      <Pressable
        onPress={onSignOut}
        disabled={restoring}
        accessibilityRole="link"
        accessibilityLabel={t.signOut}
        hitSlop={8}
        style={styles.signOut}
        testID="vault.restore.signOut"
      >
        <AppText variant="bodyStrong" color="primaryDark">
          {t.signOut}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    titles: { gap: spacing.xl },
    center: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.block },
    notice: {
      padding: spacing.xl,
      borderRadius: 14,
      backgroundColor: colors.dangerSurface,
      gap: spacing.md,
    },
    form: { gap: spacing.section },
    field: { gap: spacing.md },
    input: {
      height: size.input,
      paddingHorizontal: 16,
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontFamily: fonts.amount.semibold,
      // The design draws 22 px boxes of 6 digits; 26 characters need a smaller size to fit.
      fontSize: 15,
      letterSpacing: 0.5,
    },
    inputFocused: { borderColor: colors.primary },
    inputError: { borderColor: colors.danger },
    signOut: { alignSelf: 'center', paddingVertical: spacing.lg },
  });
