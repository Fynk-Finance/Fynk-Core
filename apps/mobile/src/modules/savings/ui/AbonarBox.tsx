// "Abonar a esta meta" inside an open goal card (design Metas): lime tinted box with three amount
// chips ($50.000, $100.000, $200.000), "Otro monto" with a "$" prefix, and the lime "Abonar"
// button. A chip and a typed amount exclude each other. It records today's aporte; Fynk never
// moves money, so the line under it says it is a record.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatCop, parseCopInput } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import { AppText, Icon, fonts, useTheme, useThemedStyles, type Theme } from '@shared/ui';

import { savingsStrings } from './strings.es-CO';

const t = savingsStrings.abonar;

/** $50.000, $100.000 and $200.000, as in the design. */
export const ABONAR_AMOUNTS: readonly MoneyMinor[] = [5_000_000, 10_000_000, 20_000_000];

export interface AbonarBoxProps {
  goalId: string;
  goalName: string;
  /** Records the aporte. Rejects when it could not be saved. */
  onAbonar: (amountMinor: MoneyMinor) => Promise<void>;
}

export function AbonarBox({ goalId, goalName, onAbonar }: AbonarBoxProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [chip, setChip] = useState<MoneyMinor | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount = chip ?? parseCopInput(typed);

  const submit = async () => {
    if (amount === null || amount <= 0) {
      setError(t.invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onAbonar(amount);
      setChip(null);
      setTyped('');
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.box} testID={`savings.abonar.${goalId}`}>
      <AppText variant="smallStrong">{t.title}</AppText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t.amounts}>
        {ABONAR_AMOUNTS.map((value) => {
          const selected = chip === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                setChip(selected ? null : value);
                setTyped('');
                setError(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.chip, selected ? styles.chipOn : null]}
              testID={`savings.abonar.${goalId}.chip.${value}`}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>
                {formatCop(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.dollar}>$</Text>
          <TextInput
            value={typed}
            onChangeText={(value) => {
              setTyped(value);
              setChip(null);
              setError(null);
            }}
            keyboardType="numeric"
            placeholder={t.other}
            placeholderTextColor={colors.textPlaceholder}
            accessibilityLabel={t.other}
            style={styles.input}
            testID={`savings.abonar.${goalId}.other`}
          />
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={
            amount && amount > 0 ? t.buttonLabel(formatCop(amount), goalName) : t.button
          }
          accessibilityState={{ busy: saving }}
          style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
          testID={`savings.abonar.${goalId}.submit`}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Icon name="plus" size={16} color={colors.onPrimary} strokeWidth={2.8} />
          )}
          <Text style={styles.buttonText}>{t.button}</Text>
        </Pressable>
      </View>
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textSecondary" style={styles.note}>
        {t.note}
      </AppText>
    </View>
  );
}

// Sizes from Metas.html: box padding 8 and radius 16 with a lime border, chips 40 high with
// radius 11, field and button 48 high with radius 13.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    box: {
      gap: 8,
      padding: 8,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.accentSoft,
      backgroundColor: colors.accentSurface,
    },
    chips: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      height: 40,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
    chipText: { fontFamily: fonts.amount.semibold, fontSize: 13, color: colors.textPrimary },
    chipTextOn: { color: colors.onPrimary },
    row: { flexDirection: 'row', gap: 8 },
    field: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 48,
      paddingHorizontal: 8,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
    },
    dollar: { fontFamily: fonts.amount.semibold, color: colors.textSecondary },
    input: {
      flex: 1,
      height: '100%',
      fontFamily: fonts.amount.semibold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    button: {
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 13,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonPressed: { opacity: 0.85 },
    buttonText: { fontFamily: fonts.body.bold, fontSize: 14, color: colors.onPrimary },
    note: { fontSize: 11, lineHeight: 15 },
  });
