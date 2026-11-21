// Add or edit a fixed expense or subscription (SCRUM-54). New screen, needs design review: it is
// built from the fields of the onboarding card in the design (OnbGastos: Nombre, Categoría,
// Monto, Día de pago, Recordatorio, Eliminar gasto) plus the type and periodicity of HU-038.
// Pushed with the default transition. Route params: { id } to edit, none to add.
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  BackButton,
  dialog,
  GhostButton,
  PrimaryButton,
  Screen,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { RecurringError, RecurringField } from '../domain/item';
import type { RecurringService } from '../application/recurringService';
import { emptyForm, formFromItem, readForm, type RecurringForm } from './formState';
import { RecurringFormFields } from './RecurringFormFields';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.form;

export const RECURRING_FORM_ROUTE = 'recurring.Form' as const;
/** The same form opened by a reminder's link, fynk://billetera/recurrentes/<id>. */
export const RECURRING_EDIT_ROUTE = 'recurring.Edit' as const;
export type RecurringFormParams = { id?: string } | undefined;

export function createRecurringFormScreen({ service }: { service: RecurringService }) {
  return function RecurringFormScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const id = (route.params as RecurringFormParams)?.id;
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();

    const [form, setForm] = useState<RecurringForm>(emptyForm);
    const [errors, setErrors] = useState<Partial<Record<RecurringField, RecurringError>>>({});
    const [loading, setLoading] = useState(Boolean(id));
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
      if (!id) return;
      let active = true;
      service
        .get(id)
        .then((item) => {
          if (!active) return;
          if (item) setForm(formFromItem(item));
          else setFailure(t.notFound);
        })
        .catch(() => active && setFailure(t.saveFailed))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [id]);

    const save = async () => {
      const read = readForm(form);
      if (!read.ok) {
        setErrors(read.errors);
        return;
      }
      setErrors({});
      setSaving(true);
      setFailure(null);
      try {
        if (id) await service.update(id, read.input);
        else await service.create(read.input);
        navigation.goBack();
      } catch {
        setFailure(t.saveFailed);
      } finally {
        setSaving(false);
      }
    };

    const confirmDelete = () => {
      if (!id) return;
      dialog.show(t.confirmDelete.title(form.name.trim()), t.confirmDelete.message, [
        { text: t.confirmDelete.cancel, style: 'cancel' },
        {
          text: t.confirmDelete.confirm,
          style: 'destructive',
          onPress: () => {
            service
              .remove(id)
              .then(() => navigation.goBack())
              .catch(() => setFailure(t.saveFailed));
          },
        },
      ]);
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {id ? t.editTitle : t.newTitle}
        </AppText>
      </View>
    );

    return (
      <Screen header={header} scroll padded={false} testID="recurring.form">
        <View style={styles.content}>
          <RecurringFormFields form={form} onChange={setForm} errors={errors} loading={loading} />

          {failure ? (
            <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
              {failure}
            </AppText>
          ) : null}

          <PrimaryButton
            label={t.save}
            onPress={() => void save()}
            loading={saving}
            disabled={loading}
            testID="recurring.form.save"
          />
          {id ? (
            <GhostButton
              label={t.delete}
              tone="danger"
              icon="trash"
              onPress={confirmDelete}
              testID="recurring.form.delete"
            />
          ) : null}
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingBottom: 32, gap: spacing.section },
  });
