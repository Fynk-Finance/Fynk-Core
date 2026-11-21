// Development-only screen that shows every story of the design system (opened from the app
// in development builds). It replaces Storybook so the team adds no extra tooling.
// "Claro" and "Oscuro" redraw every story in that theme, without touching the saved choice.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { Chip } from '../components/Chip';
import { ThemeProvider, useThemedStyles, type Theme, type ThemePreferenceStore } from '../theme';
import { spacing, type ColorScheme } from '../tokens';
import { storyGroups } from './index';

// The catalog's switch is local: it never saves over the person's Apariencia choice.
const catalogStore: ThemePreferenceStore = { load: async () => 'system', save: async () => {} };

export function CatalogScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');
  return (
    <ThemeProvider key={scheme} initialPreference={scheme} store={catalogStore}>
      <Catalog scheme={scheme} onScheme={setScheme} />
    </ThemeProvider>
  );
}

function Catalog({
  scheme,
  onScheme,
}: {
  scheme: ColorScheme;
  onScheme: (next: ColorScheme) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        padding: spacing.screen,
        paddingTop: insets.top + spacing.screen,
        gap: 28,
      }}
    >
      <AppText variant="screenTitle">Catálogo de componentes</AppText>
      <View style={styles.schemes}>
        <Chip label="Claro" selected={scheme === 'light'} onPress={() => onScheme('light')} />
        <Chip label="Oscuro" selected={scheme === 'dark'} onPress={() => onScheme('dark')} />
      </View>
      {storyGroups.map((group) => (
        <View key={group.title} style={styles.group}>
          <AppText variant="section">{group.title}</AppText>
          {Object.entries(group.stories).map(([name, Story]) => (
            <View key={name} style={styles.story}>
              <AppText variant="captionStrong" color="textSecondary">
                {name}
              </AppText>
              <Story />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    group: { gap: 14 },
    story: { gap: 8 },
    schemes: { flexDirection: 'row', gap: 8 },
  });
