// Listo (OnbListo, SCRUM-69): the blue hero with the lime check, "¡Todo listo, <nombre>!", and the
// sheet "Esto es lo que registraste" with one row per part of the setup, its count and total.
// "Ir a mi dashboard" ends the setup; the gate then fades to the tabs. No way back (inventory row
// 27): the gesture is off in the navigator and the Android back button is held here.
// The numbers come from the owning modules through `loadSummary`, read again whenever Listo is on
// top, so a recovery code saved from the pending row shows as "Guardado" on return.
// The motion of the design is in ListoMotion.tsx.
import {
  useFocusEffect,
  useNavigation,
  usePreventRemove,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { formatCop } from '@shared/domain/money';
import {
  AppText,
  Icon,
  fonts,
  IconTile,
  PrimaryButton,
  radius,
  uiStrings,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

import { greetingName } from '../domain/name';
import { summaryRows, type SummaryInput, type SummaryRow } from '../domain/summary';
import {
  DrawnCheck,
  ListoBurst,
  OK_DELAY,
  ROW_DELAY,
  ROW_STEP,
  useFadeUp,
  useHeroMotion,
  usePop,
  useSheetMotion,
} from './ListoMotion';
import { useOnboarding } from './OnboardingContext';
import { RECOVERY_CODE_ROUTE } from './routes';
import { onboardingStrings } from './strings.es-CO';

const copy = onboardingStrings.listo;

export interface ListoDeps {
  /** The numbers of M6, M8, M9 and M2 (index.ts reads them). */
  loadSummary: () => Promise<SummaryInput>;
  /** The name typed in the Nombre step, or null. */
  useDisplayName: () => string | null;
}

const ICONS: Record<SummaryRow['id'], IconName | 'repeat'> = {
  email: 'mail',
  accounts: 'bank',
  goals: 'goal',
  recurring: 'repeat',
  recoveryCode: 'lock',
};

/** The two arrows of "Gastos recurrentes" (OnbListo; not in the shared icon set). */
function RepeatIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The rounded squares of the blue background (390 × 844 in the design). */
function HeroShapes() {
  const { colors } = useTheme();
  return (
    <Svg width={390} height={844} viewBox="0 0 390 844" style={StyleSheet.absoluteFill}>
      <Rect x={226} y={-86} width={230} height={230} rx={52} fill={colors.headerShapeA} />
      <Rect x={296} y={-30} width={116} height={116} rx={28} fill={colors.headerShapeB} />
      <Rect x={-70} y={560} width={190} height={190} rx={44} fill={colors.primaryPressed} />
      <Rect x={300} y={640} width={120} height={120} rx={30} fill={colors.headerShapeA} />
    </Svg>
  );
}

function detailOf(row: SummaryRow): string[] {
  switch (row.id) {
    case 'email':
      return [copy.verified];
    case 'recoveryCode':
      return [row.done ? copy.saved : copy.pending];
    case 'accounts':
      return row.done
        ? [copy.count.accounts(row.count), formatCop(row.totalMinor)]
        : [copy.pending];
    case 'goals':
    case 'recurring':
      return row.done
        ? [copy.count[row.id](row.count), copy.perMonth(formatCop(row.totalMinor))]
        : [copy.pending];
  }
}

/** One row of the sheet: it fades up, then its check pops, 0.08 s after the row above. */
function SummaryRowView({
  row,
  index,
  last,
  onOpenRecoveryCode,
}: {
  row: SummaryRow;
  index: number;
  last: boolean;
  onOpenRecoveryCode: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fade = useFadeUp(ROW_DELAY + index * ROW_STEP, 450);
  const pop = usePop(OK_DELAY + index * ROW_STEP, 450);
  const label = copy.rows[row.id];
  const detail = detailOf(row);
  const icon = ICONS[row.id];
  const content = (
    <>
      {icon === 'repeat' ? (
        <View style={styles.tile}>
          <RepeatIcon color={colors.primaryDark} />
        </View>
      ) : (
        <IconTile icon={icon} tone="soft" size={40} />
      )}
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      <View>
        {detail.map((line) => (
          <AppText key={line} variant="small" color="textSecondary" style={styles.end}>
            {line}
          </AppText>
        ))}
      </View>
      {row.done ? (
        <Animated.View style={[styles.ok, pop]}>
          <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3.4} />
        </Animated.View>
      ) : (
        <View style={styles.todo} />
      )}
    </>
  );
  const style = [styles.row, last ? null : styles.rowLine];
  return (
    <Animated.View style={fade}>
      {row.id === 'recoveryCode' && !row.done ? (
        <Pressable
          style={style}
          onPress={onOpenRecoveryCode}
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${copy.pending}. ${copy.saveCode}`}
          testID={`onboarding.listo.${row.id}`}
        >
          {content}
        </Pressable>
      ) : (
        <View
          style={style}
          accessible
          accessibilityLabel={`${label}. ${detail.join(', ')}${row.done ? `. ${copy.completed}` : ''}`}
          testID={`onboarding.listo.${row.id}`}
        >
          {content}
        </View>
      )}
    </Animated.View>
  );
}

export function createListoScreen(deps: ListoDeps) {
  return function ListoScreen() {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const service = useOnboarding();
    const name = deps.useDisplayName();
    const [rows, setRows] = useState<SummaryRow[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    // The design's sheet is 429 px high; the real height replaces it once measured.
    const [sheetHeight, setSheetHeight] = useState(429);
    const hero = useHeroMotion();
    const checkPop = usePop(80, 550);
    const title = useFadeUp(500);
    const subtitle = useFadeUp(620);
    const sheet = useSheetMotion(sheetHeight);

    // Listo has no way back: the Android back button does nothing here.
    usePreventRemove(true, () => undefined);

    useFocusEffect(
      useCallback(() => {
        let live = true;
        deps.loadSummary().then(
          (input) => {
            if (!live) return;
            setRows(summaryRows(input));
            setLoadFailed(false);
          },
          () => {
            if (live) setLoadFailed(true);
          },
        );
        return () => {
          live = false;
        };
      }, []),
    );

    const finish = async () => {
      setBusy(true);
      setFailed(false);
      try {
        await service.finish();
      } catch {
        setFailed(true);
        setBusy(false);
      }
    };

    const firstName = name ? greetingName(name) || null : null;

    return (
      <View style={styles.root} testID="onboarding.listo">
        <HeroShapes />
        <Animated.View style={[styles.hero, { paddingTop: insets.top + 24 }, hero]}>
          <View style={styles.checkBox}>
            <Animated.View style={[styles.ring, checkPop]}>
              <View style={styles.check}>
                <DrawnCheck color={colors.onPrimary} />
              </View>
            </Animated.View>
            <ListoBurst />
          </View>
          <Animated.View style={title}>
            <AppText color="onPrimary" accessibilityRole="header" style={styles.title}>
              {copy.title(firstName)}
            </AppText>
          </Animated.View>
          <Animated.View style={subtitle}>
            <AppText color="onPrimary" style={styles.subtitle}>
              {copy.subtitle}
            </AppText>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { paddingBottom: Math.max(32, insets.bottom + 16) }, sheet]}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          accessibilityLabel={copy.sheet}
        >
          <View style={styles.handle} />
          <AppText variant="section" accessibilityRole="header">
            {copy.heading}
          </AppText>
          <ScrollView style={styles.rows} contentContainerStyle={styles.rowsContent}>
            {loadFailed ? (
              <AppText variant="small" color="textSecondary">
                {copy.notLoaded}
              </AppText>
            ) : null}
            {(rows ?? []).map((row, i, all) => (
              <SummaryRowView
                key={row.id}
                row={row}
                index={i}
                last={i === all.length - 1}
                onOpenRecoveryCode={() => navigation.navigate(RECOVERY_CODE_ROUTE)}
              />
            ))}
          </ScrollView>
          {failed ? (
            <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
              {uiStrings.errorMessage}
            </AppText>
          ) : null}
          <PrimaryButton
            label={copy.cta}
            withArrow
            onPress={() => void finish()}
            loading={busy}
            testID="onboarding.listo.finish"
          />
        </Animated.View>
      </View>
    );
  };
}

// OnbListo.html: hero centered at the bottom with 56 px below; check 120 × 120, radius 34, with a
// 10 px ring at 18 % white; title Space Grotesk 700 32/38 −0.02em; text 16/24 medium at 92 %.
// Sheet radius 32 on top, padding 24/24/32, handle 40 × 4; heading 20/26; rows 8 apart with a
// divider; label 14/19 semibold; detail 13/18; check badge 24 × 24, radius 8.
const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.primary, overflow: 'hidden' },
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      paddingBottom: 56,
    },
    checkBox: { width: 140, height: 140 },
    ring: { padding: 10, borderRadius: 44, backgroundColor: colors.onPrimaryFaint },
    check: {
      width: 120,
      height: 120,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    title: {
      marginTop: 32,
      fontFamily: fonts.heading.bold,
      fontSize: 32,
      lineHeight: 38,
      letterSpacing: -0.64,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      fontFamily: fonts.body.medium,
      fontSize: 16,
      lineHeight: 24,
      opacity: 0.92,
      textAlign: 'center',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      paddingTop: 24,
      paddingHorizontal: 24,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.45,
      shadowRadius: 15,
      elevation: 12,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
      marginTop: -8,
      marginBottom: 8,
    },
    rows: { flexGrow: 0 },
    rowsContent: { paddingBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    rowLine: { borderBottomWidth: 1, borderBottomColor: colors.divider },
    tile: {
      width: 40,
      height: 40,
      borderRadius: radius.tile,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceBlue,
    },
    label: { flex: 1, lineHeight: 19 },
    end: { textAlign: 'right' },
    ok: {
      width: 24,
      height: 24,
      borderRadius: radius.tileXs,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    todo: {
      width: 24,
      height: 24,
      borderRadius: radius.tileXs,
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
    },
  });
