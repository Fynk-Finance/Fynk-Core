// "Cambiar categoría" of Detalle de movimiento, as a sheet. Built from shared components (the
// design has no such screen): new screen, needs design review. Every category with its icon
// and the current one marked. When the movement has a merchant it asks "¿Aplicar a todos los
// movimientos de <comercio>?" before changing (M7 prompt, Technical design).
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_IDS, categoryLabel } from '@shared/domain/categories';
import type { CategoryId, Id } from '@shared/domain/types';
import {
  AppText,
  Badge,
  dialog,
  Icon,
  ListRow,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import { CATEGORY_ICONS } from './categoryIcons';
import { titleOf } from './labels';
import { transactionsStrings } from './strings.es-CO';

const t = transactionsStrings.category;

export interface CategoryPickerParams {
  id: Id;
}

export interface CategoryPickerDeps {
  hooks: Pick<TransactionHooks, 'useTransaction'>;
  changeCategory: (
    id: Id,
    categoryId: CategoryId,
    opts: { applyToMerchant: boolean },
  ) => Promise<unknown>;
  /** dialog.show, replaced in tests. */
  ask?: typeof dialog.show;
}

export function createCategoryPickerSheet({
  hooks,
  changeCategory,
  ask = dialog.show,
}: CategoryPickerDeps) {
  return function CategoryPickerSheet() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<{ picker: CategoryPickerParams }, 'picker'>>();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tx = hooks.useTransaction(route.params.id).data;
    const [failed, setFailed] = useState(false);

    const save = async (categoryId: CategoryId, applyToMerchant: boolean) => {
      try {
        await changeCategory(route.params.id, categoryId, { applyToMerchant });
        navigation.goBack();
      } catch {
        setFailed(true);
      }
    };

    const pick = (categoryId: CategoryId) => {
      if (!tx) return;
      setFailed(false);
      if (!tx.merchantKey) {
        void save(categoryId, false);
        return;
      }
      ask(t.applyAllTitle(titleOf(tx)), t.applyAllMessage, [
        { text: t.onlyThis, onPress: () => void save(categoryId, false) },
        { text: t.applyAll, onPress: () => void save(categoryId, true) },
      ]);
    };

    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        testID="transactions.categoryPicker"
      >
        <View style={styles.header}>
          <AppText variant="section" accessibilityRole="header">
            {t.title}
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
        {failed ? (
          <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
            {t.error}
          </AppText>
        ) : null}
        {CATEGORY_IDS.map((id) => (
          <ListRow
            key={id}
            title={categoryLabel(id)}
            icon={CATEGORY_ICONS[id]}
            iconSize={40}
            badge={tx?.categoryId === id ? <Badge label={t.current} size="sm" /> : undefined}
            onPress={() => pick(id)}
            testID={`transactions.category.${id}`}
          />
        ))}
      </ScrollView>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { backgroundColor: colors.background },
    content: { paddingTop: 24, paddingHorizontal: 20, gap: 4 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    close: {
      width: size.backButton,
      height: size.backButton,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
  });
