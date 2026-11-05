// "Tus gastos recurrentes" of onboarding step 5 (design OnbGastos), built by M9 for M3 to place
// inside its step frame: the title with "4 gastos", the items as collapsible cards (soft tile,
// name, "Vivienda · día 5", amount, chevron), the open one with the fields of the form, the
// dashed "Agregar gasto recurrente" and the "Total mensual · Te avisaremos de 2 pagos" box.
// With no items yet, a new one is open. "Terminar configuración" belongs to M3's frame.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryLabel } from '@shared/domain/categories';
import {
  AmountText,
  AppText,
  GhostButton,
  Icon,
  IconTile,
  PrimaryButton,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { RecurringService } from '../application/recurringService';
import { scheduleLabel } from '../domain/card';
import type { RecurringError, RecurringField, StoredRecurringItem } from '../domain/item';
import { emptyForm, formFromItem, readForm, type RecurringForm } from './formState';
import { CATEGORY_ICONS } from './RecurringCard';
import { RecurringFormFields } from './RecurringFormFields';
import { setupStrings as t } from './strings.es-CO';

const NEW = 'new';

export function createRecurringSetup({ service }: { service: RecurringService }) {
  return function RecurringSetup() {
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const [items, setItems] = useState<StoredRecurringItem[] | null>(null);
    const [total, setTotal] = useState(0);
    const [open, setOpen] = useState<string | null>(null);
    const [form, setForm] = useState<RecurringForm>(emptyForm);
    const [errors, setErrors] = useState<Partial<Record<RecurringField, RecurringError>>>({});
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const load = useCallback(async () => {
      const [list, monthly] = await Promise.all([
        service.list().catch(() => [] as StoredRecurringItem[]),
        service.fixedExpensesThisMonth().catch(() => 0),
      ]);
      const active = list.filter((i) => i.status === 'active');
      setItems(active);
      setTotal(monthly);
      return active;
    }, []);

    useEffect(() => {
      void load().then((list) => {
        if (list.length === 0) setOpen(NEW);
      });
    }, [load]);

    const openCard = (id: string | null) => {
      setErrors({});
      setFailure(null);
      setOpen(id);
      const item = items?.find((i) => i.id === id);
      setForm(item ? formFromItem(item) : emptyForm());
    };

    const editing = items?.find((i) => i.id === open) ?? null;

    const save = async () => {
      const read = readForm(form);
      if (!read.ok) return setErrors(read.errors);
      setErrors({});
      setBusy(true);
      setFailure(null);
      try {
        if (editing) await service.update(editing.id, read.input);
        else await service.create(read.input);
        await load();
        setOpen(null);
      } catch {
        setFailure(t.failed);
      } finally {
        setBusy(false);
      }
    };

    const remove = async (id: string) => {
      setBusy(true);
      try {
        await service.remove(id);
        const list = await load();
        setForm(emptyForm());
        setOpen(list.length === 0 ? NEW : null);
      } catch {
        setFailure(t.failed);
      } finally {
        setBusy(false);
      }
    };

    const card = (
      id: string,
      icon: StoredRecurringItem['categoryId'],
      name: string,
      summary: string,
      amountMinor: number | null,
      isOpen: boolean,
    ) => (
      <View
        key={id}
        style={[styles.card, isOpen ? styles.cardOpen : null]}
        testID={`recurring.setup.${id}`}
      >
        <Pressable
          onPress={() => openCard(isOpen ? null : id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={isOpen ? t.collapse(name) : t.expand(name)}
          style={styles.cardHead}
          testID={`recurring.setup.${id}.toggle`}
        >
          <IconTile icon={CATEGORY_ICONS[icon] ?? 'card'} tone="soft" size={40} />
          <View style={styles.cardText}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {summary}
            </AppText>
          </View>
          {amountMinor !== null ? <AmountText amountMinor={amountMinor} size={13} /> : null}
          <View style={isOpen ? styles.flipped : null}>
            <Icon name="chevronDown" size={16} color={colors.textSecondary} />
          </View>
        </Pressable>
        {isOpen ? (
          <View style={styles.cardBody}>
            <RecurringFormFields
              form={form}
              onChange={setForm}
              errors={errors}
              testID={`recurring.setup.${id}`}
            />
            {failure ? (
              <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
                {failure}
              </AppText>
            ) : null}
            <PrimaryButton
              label={t.save}
              onPress={() => void save()}
              loading={busy}
              testID={`recurring.setup.${id}.save`}
            />
            {editing ? (
              <GhostButton
                label={t.delete}
                tone="danger"
                icon="trash"
                disabled={busy}
                onPress={() => void remove(editing.id)}
                testID={`recurring.setup.${id}.delete`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );

    const list = items ?? [];
    const reminders = list.filter((i) => i.reminderEnabled).length;

    return (
      <View style={styles.list} testID="recurring.setup">
        <View style={styles.title}>
          <AppText variant="headerTitle" accessibilityRole="header">
            {t.title}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {t.count(list.length)}
          </AppText>
        </View>

        {list.map((item) =>
          card(
            item.id,
            item.categoryId,
            item.name,
            t.summary(categoryLabel(item.categoryId), scheduleLabel(item.schedule)),
            item.amountMinor,
            open === item.id,
          ),
        )}
        {open === NEW
          ? card(
              NEW,
              form.categoryId,
              form.name.trim() || t.newItem,
              categoryLabel(form.categoryId),
              null,
              true,
            )
          : null}

        {items !== null && open !== NEW ? (
          <Pressable
            onPress={() => openCard(NEW)}
            accessibilityRole="button"
            style={styles.add}
            testID="recurring.setup.add"
          >
            <Icon name="plus" size={18} color={colors.primaryDeep} />
            <AppText variant="bodyStrong" style={{ color: colors.primaryDeep }}>
              {t.add}
            </AppText>
          </Pressable>
        ) : null}

        <View style={styles.total} testID="recurring.setup.total">
          <View style={styles.totalText}>
            <AppText variant="label">{t.total}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t.reminders(reminders)}
            </AppText>
          </View>
          <AmountText amountMinor={total} size={17} />
        </View>
      </View>
    );
  };
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    list: { gap: spacing.md },
    title: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...shadow.card,
    },
    cardOpen: { borderColor: colors.borderBlueStrong },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 8 },
    cardText: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    flipped: { transform: [{ rotate: '180deg' }] },
    cardBody: {
      gap: spacing.section,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.borderBlue,
    },
    // Dashed primary border on the soft blue surface (OnbGastos).
    add: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      borderRadius: radius.button,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.surfaceBlueSoft,
    },
    // "Total mensual" on surfaceBlue, radius 16 (OnbGastos).
    total: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: radius.button,
      backgroundColor: colors.surfaceBlue,
    },
    totalText: { gap: 2 },
  });
