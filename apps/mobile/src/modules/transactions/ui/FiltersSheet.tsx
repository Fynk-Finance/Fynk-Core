// Filtros (opened from the "Filtros" button of Movimientos, inventory row 13, as a sheet). The
// design exports this sheet closed, so it is built from shared components: new screen, needs
// design review. Tipo (Todos, Ingresos, Gastos), Fecha (presets or a custom range), Monto
// (minimum and maximum), Cuentas and Categorías, then "Limpiar" and "Aplicar".
import {
  StackActions,
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
import type { Account, Clock } from '@shared/domain/types';
import {
  AppText,
  Chip,
  GhostButton,
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

import { DATE_PRESETS } from '../domain/filter';
import {
  draftFrom,
  draftToFilter,
  EMPTY_DRAFT,
  toggle,
  type DateChoice,
  type DraftError,
  type FilterDraft,
  type KindChoice,
} from '../domain/filterDraft';
import type { TransactionFilter } from '../domain/query';
import { FILTERS_ROUTE, TRANSACTIONS_ROUTE } from './routes';
import { transactionsStrings } from './strings.es-CO';

const s = transactionsStrings.filters;

export { FILTERS_ROUTE };
export interface FiltersParams {
  filter?: TransactionFilter;
}

const DATE_CHOICES: DateChoice[] = ['any', ...DATE_PRESETS, 'custom'];
const KIND_OPTIONS: { value: KindChoice; label: string }[] = [
  { value: 'all', label: s.kinds.all },
  { value: 'income', label: s.kinds.income },
  { value: 'expense', label: s.kinds.expense },
];

const ERROR_TEXT: Record<DraftError, string> = {
  from: s.errors.day,
  to: s.errors.day,
  dates: s.errors.dates,
  min: s.errors.amount,
  max: s.errors.amount,
  amounts: s.errors.amounts,
};

export interface FiltersSheetDeps {
  useAccounts: () => { data?: { accounts: Account[] } };
  clock: Clock;
}

export function createFiltersSheet({ useAccounts, clock }: FiltersSheetDeps) {
  return function FiltersSheet() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<{ filters: FiltersParams }, 'filters'>>();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const accounts = (useAccounts().data?.accounts ?? []).filter((a) => a.kind !== 'cdt');
    const [draft, setDraft] = useState<FilterDraft>(() =>
      draftFrom(route.params?.filter ?? {}, clock.now()),
    );
    const [errors, setErrors] = useState<DraftError[]>([]);

    const set = (patch: Partial<FilterDraft>) => {
      setDraft((d) => ({ ...d, ...patch }));
      setErrors([]);
    };
    const fieldError = (...keys: DraftError[]) => {
      const key = keys.find((k) => errors.includes(k));
      return key ? ERROR_TEXT[key] : undefined;
    };

    const apply = () => {
      const result = draftToFilter(draft, clock.now());
      if (result.filter === null) {
        setErrors(result.errors);
        return;
      }
      navigation.dispatch(
        StackActions.popTo(TRANSACTIONS_ROUTE, { filter: result.filter }, { merge: true }),
      );
    };

    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        testID="transactions.filters"
      >
        <View style={styles.header}>
          <AppText variant="section" accessibilityRole="header">
            {s.title}
          </AppText>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={s.close}
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}
          >
            <Icon name="close" size={20} strokeWidth={2.4} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Group title={s.kind}>
          <SegmentedControl
            options={KIND_OPTIONS}
            value={draft.kind}
            onChange={(kind) => set({ kind })}
            accessibilityLabel={s.kind}
          />
        </Group>

        <Group title={s.dates}>
          <View style={styles.chips}>
            {DATE_CHOICES.map((choice) => (
              <Chip
                key={choice}
                label={s.presets[choice]}
                selected={draft.dates === choice}
                onPress={() => set({ dates: choice })}
              />
            ))}
          </View>
          {draft.dates === 'custom' ? (
            <View style={styles.pair}>
              <View style={styles.half}>
                <TextField
                  label={s.from}
                  value={draft.fromText}
                  onChangeText={(fromText) => set({ fromText })}
                  placeholder={s.dayPlaceholder}
                  keyboardType="numbers-and-punctuation"
                  error={fieldError('from', 'dates')}
                />
              </View>
              <View style={styles.half}>
                <TextField
                  label={s.to}
                  value={draft.toText}
                  onChangeText={(toText) => set({ toText })}
                  placeholder={s.dayPlaceholder}
                  keyboardType="numbers-and-punctuation"
                  error={fieldError('to')}
                />
              </View>
            </View>
          ) : null}
        </Group>

        <Group title={s.amount}>
          <View style={styles.pair}>
            <View style={styles.half}>
              <TextField
                label={s.min}
                prefix="$"
                value={draft.minText}
                onChangeText={(minText) => set({ minText })}
                keyboardType="number-pad"
                error={fieldError('min', 'amounts')}
              />
            </View>
            <View style={styles.half}>
              <TextField
                label={s.max}
                prefix="$"
                value={draft.maxText}
                onChangeText={(maxText) => set({ maxText })}
                keyboardType="number-pad"
                error={fieldError('max')}
              />
            </View>
          </View>
        </Group>

        {accounts.length > 0 ? (
          <Group title={s.accounts}>
            <View style={styles.chips}>
              {accounts.map((account) => (
                <Chip
                  key={account.id}
                  label={account.displayName}
                  selected={draft.accountIds.includes(account.id)}
                  onPress={() => set({ accountIds: toggle(draft.accountIds, account.id) })}
                />
              ))}
            </View>
          </Group>
        ) : null}

        <Group title={s.categories}>
          <View style={styles.chips}>
            {CATEGORY_IDS.map((id) => (
              <Chip
                key={id}
                label={categoryLabel(id)}
                selected={draft.categoryIds.includes(id)}
                onPress={() => set({ categoryIds: toggle(draft.categoryIds, id) })}
              />
            ))}
          </View>
        </Group>

        <View style={styles.actions}>
          <View style={styles.half}>
            <GhostButton label={s.clear} onPress={() => set(EMPTY_DRAFT)} />
          </View>
          <View style={styles.half}>
            <PrimaryButton label={s.apply} onPress={apply} testID="transactions.filters.apply" />
          </View>
        </View>
      </ScrollView>
    );
  };
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={groupStyles.group}>
      <AppText variant="smallStrong" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const groupStyles = StyleSheet.create({ group: { gap: 8 } });

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.background },
    content: { paddingTop: 24, paddingHorizontal: 20, gap: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    close: {
      width: size.backButton,
      height: size.backButton,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pair: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    actions: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  });
