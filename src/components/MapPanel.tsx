import { StyleSheet, Text, View } from "react-native";

import type { MapBounds } from "../data/eclipseEvents";
import type { GeoPoint } from "../domain/geo";
import { theme } from "../styles/theme";

interface MapPanelProps {
  bounds: MapBounds;
  candidates?: readonly GeoPoint[];
  centerLine: readonly GeoPoint[];
  location: GeoPoint;
  onLocationChange: (location: GeoPoint) => void;
}

export const MapPanel = (_props: MapPanelProps) => (
  <View style={styles.unavailable}>
    <Text style={styles.text}>The map is available in the web app.</Text>
  </View>
);

const styles = StyleSheet.create({
  unavailable: {
    alignItems: "center",
    backgroundColor: theme.color.background,
    height: 280,
    justifyContent: "center",
  },
  text: {
    color: theme.color.muted,
  },
});
