import { StyleSheet, Text, View } from "react-native";

import { theme } from "../styles/theme";

interface TimelineSliderProps {
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  value: number;
}

export const TimelineSlider = (_props: TimelineSliderProps) => (
  <View style={styles.container}>
    <Text style={styles.text}>Timeline scrubbing is available in the web app.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { paddingVertical: theme.space.small },
  text: { color: theme.color.muted, fontSize: 12 },
});
