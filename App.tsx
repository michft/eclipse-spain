import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { theme } from '@/styles/theme';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>FIELD PLANNER</Text>
          <Text accessibilityRole="header" style={styles.heading}>
            Eclipse Observer
          </Text>
          <Text style={styles.lede}>
            Choose a location, understand the horizon, and prepare a spoken eclipse timeline.
          </Text>
        </View>

        <View style={styles.grid}>
          <Card eyebrow="01" title="Event and location">
            <Text style={styles.placeholder}>Map and location controls will appear here.</Text>
          </Card>
          <Card eyebrow="02" title="Location analysis">
            <Text style={styles.placeholder}>Eclipse, site, cloud, and transport results.</Text>
          </Card>
          <Card eyebrow="03" title="Audio timeline">
            <Text style={styles.placeholder}>Editable spoken markers and countdown controls.</Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.color.background,
    flex: 1,
  },
  page: {
    alignSelf: 'center',
    gap: theme.space.xlarge,
    maxWidth: 1180,
    paddingHorizontal: theme.space.medium,
    paddingVertical: theme.space.xlarge,
    width: '100%',
  },
  hero: {
    gap: theme.space.small,
    maxWidth: 760,
  },
  kicker: {
    color: theme.color.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heading: {
    color: theme.color.text,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  lede: {
    color: theme.color.muted,
    fontSize: 18,
    lineHeight: 27,
  },
  grid: {
    gap: theme.space.medium,
  },
  placeholder: {
    color: theme.color.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
