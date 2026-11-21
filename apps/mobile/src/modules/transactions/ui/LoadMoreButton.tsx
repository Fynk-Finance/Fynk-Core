// "Cargar 20 más" (Movimientos `.more`): 48 px, radius 15, light blue, bold blue text. While the
// next page loads it shows a spinner and stays disabled.
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText, fonts, size, useTheme, useThemedStyles, type Theme } from '@shared/ui';

import { transactionsStrings as s } from './strings.es-CO';

export interface LoadMoreButtonProps {
  loading: boolean;
  onPress: () => void;
  testID?: string;
}

export function LoadMoreButton({ loading, onPress, testID }: LoadMoreButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={s.list.loadMore}
      accessibilityState={{ busy: loading }}
      testID={testID}
      style={({ pressed }) => [styles.more, pressed ? styles.pressed : null]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryDark} />
      ) : (
        <AppText variant="label" style={styles.text}>
          {s.list.loadMore}
        </AppText>
      )}
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    more: {
      marginTop: 16,
      height: size.iconButton,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: colors.surfaceBlue },
    text: { fontFamily: fonts.body.bold, color: colors.primaryDeep },
  });
