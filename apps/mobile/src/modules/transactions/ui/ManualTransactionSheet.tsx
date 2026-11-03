// "Registrar gasto o ingreso" (the Dashboard FAB) and "Editar" of a manual movement, as a
// sheet. The design exports the FAB sheet closed (only its CSS: a segmented control, fields, a
// dropdown and "Guardar"), so it is built from shared components: new screen, needs design
// review. Gasto or Ingreso, Monto, Cuenta (Efectivo included), Fecha, Descripción, Categoría.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_IDS, categoryLabel } from '@shared/domain/categories';
import type { Account, Clock, Id, Transaction } from '@shared/domain/types';
import {
  AppText,
  Chip,
  EmptyState,
  Icon,
  PrimaryButton,
  SegmentedControl,
  TextField,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import type { ManualInput } from '../domain/manual';
import {
  emptyManualDraft,
  manualDraftFrom,
  manualDraftToInput,
  type DayChoice,
  type ManualDraft,
  type ManualDraftError,
} from '../domain/manualDraft';
import { accountLabel } from './labels';
import { transactionsStrings } from './strings.es-CO';

const t = transactionsStrings.manual;
const DAY_CHOICES: DayChoice[] = ['today', 'yesterday', 'other'];

export interface ManualTransactionParams {
  /** Set to edit a manual movement. */
  id?: Id;
}

export interface ManualTransactionDeps {
  hooks: Pick<TransactionHooks, 'useTransaction'>;
  useAccounts: () => { data?: { accounts: Account[] } };
  add: (input: ManualInput) => Promise<Transaction>;
  update: (id: Id, input: ManualInput) => Promise<Transaction>;
  clock: Clock;
}

export function createManualTransactionSheet(deps: ManualTransactionDeps) {
  return function ManualTransactionSheet() {
    const route = useRoute<RouteProp<{ manual: ManualTransactionParams }, 'manual'>>();
    const id = route.params?.id;
    const editing = deps.hooks.useTransaction(id ?? '').data;
    const accounts = (deps.useAccounts().data?.accounts ?? []).filter((a) => a.kind !== 'cdt');
    if (id && !editing) return null;
    return (
      <Form
        key={editing?.id ?? 'new'}
        deps={deps}
        accounts={accounts}
        editing={editing && editing.source === 'manual' ? editing : null}
      />
    );
  };
}

function Form({
  deps,
  accounts,
  editing,
}: {
  deps: ManualTransactionDeps;
  accounts: Account[];
  editing: Transaction | null;
}) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const cash = accounts.find((a) => a.kind === 'cash');
  const [draft, setDraft] = useState<ManualDraft>(() =>
    editing
      ? manualDraftFrom(editing, deps.clock.now())
      : emptyManualDraft(cash?.id ?? accounts[0]?.id ?? null),
  );
  const [errors, setErrors] = useState<ManualDraftError[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const set = (patch: Partial<ManualDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors([]);
    setFailed(false);
  };
  const errorOf = (key: ManualDraftError) => (errors.includes(key) ? t.errors[key] : undefined);

  const save = async () => {
    const result = manualDraftToInput(draft, deps.clock.now(), editing?.bookedAt);
    if (result.input === null) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    try {
      if (editing) await deps.update(editing.id, result.input);
      else await deps.add(result.input);
      navigation.goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <AppText variant="section" accessibilityRole="header">
        {editing ? t.editTitle : t.newTitle}
      </AppText>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t.close}
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
      >
        <Icon name="close" size={20} strokeWidth={2.4} color={colors.textSecondary} />
      </Pressable>
    </View>
  );

  if (accounts.length === 0) {
    return (
      <View style={[styles.root, styles.content]} testID="transactions.manual">
        {header}
        <EmptyState title={t.noAccounts} icon="cash" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      testID="transactions.manual"
    >
      {header}
      <SegmentedControl
        options={[
          { value: 'expense', label: t.expense },
          { value: 'income', label: t.income },
        ]}
        value={draft.kind}
        onChange={(kind) => set({ kind })}
        accessibilityLabel={t.kind}
      />
      <TextField
        label={t.amount}
        prefix="$"
        value={draft.amountText}
        onChangeText={(amountText) => set({ amountText })}
        keyboardType="number-pad"
        error={errorOf('amount')}
      />
      <Group title={t.account} error={errorOf('account')}>
        {accounts.map((account) => (
          <Chip
            key={account.id}
            label={accountLabel(account)}
            selected={draft.accountId === account.id}
            onPress={() => set({ accountId: account.id })}
          />
        ))}
      </Group>
      <Group title={t.day}>
        {DAY_CHOICES.map((choice) => (
          <Chip
            key={choice}
            label={t.days[choice]}
            selected={draft.day === choice}
            onPress={() => set({ day: choice })}
          />
        ))}
      </Group>
      {draft.day === 'other' ? (
        <TextField
          label={t.day}
          value={draft.dayText}
          onChangeText={(dayText) => set({ dayText })}
          placeholder={t.dayPlaceholder}
          keyboardType="numbers-and-punctuation"
          error={errorOf('day')}
        />
      ) : errorOf('day') ? (
        <AppText variant="small" color="danger">
          {errorOf('day')}
        </AppText>
      ) : null}
      <TextField
        label={t.description}
        value={draft.description}
        onChangeText={(description) => set({ description })}
        placeholder={t.descriptionPlaceholder}
        maxLength={80}
        error={errorOf('description')}
      />
      <Group title={t.category}>
        <Chip
          label={t.automatic}
          selected={draft.categoryId === null}
          onPress={() => set({ categoryId: null })}
        />
        {CATEGORY_IDS.map((categoryId) => (
          <Chip
            key={categoryId}
            label={categoryLabel(categoryId)}
            selected={draft.categoryId === categoryId}
            onPress={() => set({ categoryId })}
          />
        ))}
      </Group>
      <AppText variant="caption" color="textSecondary">
        {t.note}
      </AppText>
      {failed ? (
        <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
          {t.errors.save}
        </AppText>
      ) : null}
      <PrimaryButton
        label={t.save}
        onPress={() => void save()}
        loading={saving}
        testID="transactions.manual.save"
      />
    </ScrollView>
  );
}

function Group({ title, error, children }: { title: string; error?: string; children: ReactNode }) {
  return (
    <View style={groupStyles.group}>
      <AppText variant="smallStrong">{title}</AppText>
      <View style={groupStyles.chips}>{children}</View>
      {error ? (
        <AppText variant="small" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const groupStyles = StyleSheet.create({
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.background },
    content: { paddingTop: 24, paddingHorizontal: 20, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    close: {
      width: size.backButton,
      height: size.backButton,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
  });
