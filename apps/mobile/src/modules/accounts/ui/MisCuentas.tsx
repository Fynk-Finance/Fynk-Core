// "Mis cuentas" for other modules' screens: Billetera (M9, design Billetera) and Mi cuenta (M1,
// a new section that needs design review). Each takes no props, so the owner's screen only
// renders it. A row opens Detalle de cuenta; "+ Conectar" opens M5.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { QueryClientContext, type UseQueryResult } from '@tanstack/react-query';
import { useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { formatCop } from '@shared/domain/money';
import type { Account } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Badge,
  Card,
  Icon,
  SectionHeader,
  Shine,
  Skeleton,
  fontSize,
  fonts,
  initialsOf,
  radius,
  spacing,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import { entityOf } from '../domain/dashboard';
import { balanceContribution } from '../domain/netWorth';
import { ACCOUNT_DETAIL_ROUTE, shortDay } from './AccountDetailScreen';
import { rowDetail } from './AccountsPanel';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.misCuentas;
const CONNECT_ROUTE = 'bank.Connect';

export interface MisCuentasDeps {
  useAccounts: () => Pick<UseQueryResult<AccountsOverview>, 'data' | 'isPending'>;
}

type Variant = 'billetera' | 'miCuenta';

function createSection(deps: MisCuentasDeps, variant: Variant) {
  function Section() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { data, isPending } = deps.useAccounts();
    // Same accounts as Detalle de cuentas: CDTs live in the Inversión tab.
    const accounts = (data?.accounts ?? []).filter((a) => a.kind !== 'cdt');
    const open = (accountId: string) => navigation.navigate(ACCOUNT_DETAIL_ROUTE, { accountId });
    const bleed = variant === 'billetera' ? spacing.screen : spacing.screen - 4;

    return (
      <View style={styles.section} testID={`accounts.misCuentas.${variant}`}>
        <SectionHeader
          title={t.title}
          {...(variant === 'billetera'
            ? { actionLabel: t.connect, onAction: () => navigation.navigate(CONNECT_ROUTE) }
            : null)}
        />
        {isPending ? (
          <Skeleton height={104} radius={radius.button} />
        ) : accounts.length === 0 ? (
          <AppText variant="small" color="textSecondary">
            {accountsStrings.dashboard.noAccounts}
          </AppText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -bleed }}
            contentContainerStyle={[styles.scroll, { paddingHorizontal: bleed }]}
          >
            {accounts.map((a) =>
              variant === 'billetera' ? (
                <WalletCard key={a.id} account={a} onPress={() => open(a.id)} />
              ) : (
                <ProfileCard key={a.id} account={a} onPress={() => open(a.id)} />
              ),
            )}
          </ScrollView>
        )}
      </View>
    );
  }

  // Renders nothing without React Query, which only happens in other modules' screen tests.
  return function MisCuentas() {
    return useContext(QueryClientContext) ? <Section /> : null;
  };
}

/** Billetera card: initials, "Banco Demo · Ahorros" and what it adds to the balance total. */
function WalletCard({ account, onPress }: { account: Account; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const entity = entityOf(account);
  const amount = balanceContribution(account);
  const label = [
    `${t.view(entity)}. ${t.short[account.kind]}, ${formatCop(amount)}`,
    account.isSimulated ? uiStrings.simulated : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}
      testID={`accounts.misCuentas.card.${account.id}`}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={162} height={104}>
          <Rect x={96} y={-44} width={96} height={96} rx={24} fill={colors.cardShapeLight} />
          <Rect x={126} y={-20} width={54} height={54} rx={14} fill={colors.cardShapeLighter} />
          <Rect x={-26} y={72} width={60} height={60} rx={16} fill={colors.headerShapeB} />
        </Svg>
        <Shine distance={250} height={170} width={28} />
      </View>
      <View style={styles.spread}>
        <View style={styles.initials}>
          <AppText variant="caption" color="primaryLight" style={styles.initialsText}>
            {initialsOf(entity)}
          </AppText>
        </View>
        <Icon name="chevronRight" size={16} strokeWidth={2.4} color={colors.onPrimary} />
      </View>
      <View>
        <AppText variant="caption" color="onPrimary" style={styles.walletName} numberOfLines={1}>
          {`${entity} · ${t.short[account.kind]}`}
        </AppText>
        <AmountText amountMinor={amount} size={15} color="onPrimary" />
      </View>
    </Pressable>
  );
}

/** Mi cuenta card: entity, "Activa", type and last 4, balance, or the credit data of a card. */
function ProfileCard({ account, onPress }: { account: Account; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const isCard = account.kind === 'credit_card';
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={t.view(entityOf(account))}
      style={styles.profile}
      testID={`accounts.misCuentas.card.${account.id}`}
    >
      <View style={styles.badges}>
        <AppText variant="label" numberOfLines={1} style={styles.shrink}>
          {entityOf(account)}
        </AppText>
        <Badge label={t.active} tone="success" size="sm" />
        {account.isSimulated ? <Badge label={uiStrings.simulated} size="sm" /> : null}
      </View>
      <AppText variant="caption" color="textSecondary" numberOfLines={1}>
        {rowDetail(account)}
      </AppText>
      <View style={styles.amount}>
        <AppText variant="caption" color="textSecondary">
          {isCard ? accountsStrings.detail.creditAvailable : accountsStrings.detail.available}
        </AppText>
        <AmountText
          amountMinor={isCard ? (account.availableMinor ?? 0) : account.balanceMinor}
          size={17}
        />
      </View>
      {isCard ? (
        <AppText variant="caption" color="textSecondary">
          {t.creditLine(
            formatCop(account.creditLimitMinor ?? 0),
            account.paymentDueOn ? shortDay(account.paymentDueOn) : null,
          )}
        </AppText>
      ) : null}
    </Card>
  );
}

export const createMisCuentasBilletera = (deps: MisCuentasDeps) => createSection(deps, 'billetera');
export const createMisCuentasMiCuenta = (deps: MisCuentasDeps) => createSection(deps, 'miCuenta');

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    section: { gap: spacing.md },
    scroll: { gap: spacing.md, paddingBottom: spacing.xl },
    wallet: {
      width: 162,
      height: 104,
      padding: spacing.md,
      borderRadius: radius.button,
      backgroundColor: colors.primaryLight,
      justifyContent: 'space-between',
      overflow: 'hidden',
      ...shadow.balanceCard,
    },
    pressed: { opacity: 0.9 },
    spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    initials: {
      width: 24,
      height: 24,
      borderRadius: radius.tileXs,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialsText: { fontFamily: fonts.heading.bold, fontSize: fontSize[10], lineHeight: 13 },
    walletName: {
      fontFamily: fonts.body.semibold,
      fontSize: fontSize[11],
      lineHeight: 14,
      opacity: 0.95,
    },
    profile: { width: 230, gap: spacing.xs },
    badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    shrink: { flexShrink: 1 },
    amount: { marginTop: spacing.sm },
  });
