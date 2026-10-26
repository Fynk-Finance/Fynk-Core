import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder root. Step 4 of M0 replaces it with the navigation and the design system.
export function AppRoot() {
  return (
    <View style={styles.container} testID="app-root">
      <Text>Fynk</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
