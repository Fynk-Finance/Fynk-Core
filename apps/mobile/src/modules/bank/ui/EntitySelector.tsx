// "Banco o billetera digital" of Conectar banco (ConectarBanco.html): a 64 px field with the
// entity's tile, name and kind, and a chevron that opens the list. Simulated entities carry the
// "Simulado" badge. The design exports the list closed only, so the open list reuses the field's
// own rows and colors: new, needs design review. The tile shows the kind's icon instead of the
// design's initials, because "Banco Demo" and "Billetera Demo" would both be "BD".
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Icon,
  IconTile,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { BankProvider } from '../domain/provider';
import { bankStrings } from './strings.es-CO';

const t = bankStrings.selector;

export interface EntitySelectorProps {
  providers: readonly BankProvider[];
  selected: BankProvider;
  onSelect: (provider: BankProvider) => void;
  disabled?: boolean;
}

function EntityRow({ provider }: { provider: BankProvider }) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <IconTile icon={provider.kind === 'wallet' ? 'tabWallet' : 'bank'} tone="soft" size={40} />
      <View style={styles.names}>
        <View style={styles.nameRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
            {provider.displayName}
          </AppText>
          {provider.isSimulated ? <Badge label={uiStrings.simulated} size="md" /> : null}
        </View>
        <AppText variant="caption" color="textSecondary">
          {t.kind[provider.kind]}
        </AppText>
      </View>
    </>
  );
}

export function EntitySelector({
  providers,
  selected,
  onSelect,
  disabled = false,
}: EntitySelectorProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <AppText variant="label" nativeID="bank.selector.label">
        {t.label}
      </AppText>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${t.label}: ${selected.displayName}`}
        accessibilityHint={t.openHint}
        accessibilityState={{ expanded: open, disabled }}
        style={({ pressed }) => [styles.field, pressed || open ? styles.fieldActive : null]}
        testID="bank.selector"
      >
        <EntityRow provider={selected} />
        <View style={open ? styles.chevronOpen : null}>
          <Icon name="chevronDown" size={24} color={colors.textSecondary} strokeWidth={2.4} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.list} accessibilityRole="list" testID="bank.selector.list">
          {providers.map((p) => {
            const isSelected = p.id === selected.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  setOpen(false);
                  if (!isSelected) onSelect(p);
                }}
                accessibilityRole="radio"
                accessibilityLabel={p.displayName}
                accessibilityState={{ selected: isSelected, checked: isSelected }}
                style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}
                testID={`bank.selector.option.${p.id}`}
              >
                <EntityRow provider={p} />
                {isSelected ? (
                  <Icon
                    name="check"
                    size={20}
                    color={colors.primaryDark}
                    strokeWidth={2.4}
                    accessibilityLabel={t.selected}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// Sizes from ConectarBanco.html: label gap 8, field 64 high with 16/8 padding, radius 16,
// a 1.5 px light blue border on the soft blue surface.
const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    container: { gap: 8 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 64,
      paddingLeft: 8,
      paddingRight: 16,
      borderRadius: radius.button,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    fieldActive: { borderColor: colors.borderBlueStrong },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    names: { flex: 1, gap: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { flexShrink: 1 },
    list: {
      borderRadius: radius.button,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      paddingVertical: 4,
      ...shadow.card,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 64,
      paddingLeft: 8,
      paddingRight: 16,
    },
    optionPressed: { backgroundColor: colors.surfaceBlueSoft },
  });
