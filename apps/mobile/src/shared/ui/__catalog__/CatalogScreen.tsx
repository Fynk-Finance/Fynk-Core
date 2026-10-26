// Development-only screen that shows every story of the design system (opened from the app
// in development builds). It replaces Storybook so the team adds no extra tooling.
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { colors, spacing } from '../tokens';
import { storyGroups } from './index';

export function CatalogScreen() {
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  group: { gap: 14 },
  story: { gap: 8 },
});
