import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";

import type { ObserverSkyState } from "../domain/eclipse";
import {
  eclipseDiscGeometry,
  type EclipsePhase,
} from "../domain/eclipseOverlay";
import { theme } from "../styles/theme";

interface EclipseContactOverlayProps {
  phase: EclipsePhase;
  sky: ObserverSkyState;
}

const WIDTH = 260;
const HEIGHT = 210;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const SUN_RADIUS_PIXELS = 32;

export const EclipseContactOverlay = ({
  phase,
  sky,
}: EclipseContactOverlayProps) => {
  const geometry = eclipseDiscGeometry(sky);
  const pixelsPerDegree = SUN_RADIUS_PIXELS / geometry.sunRadiusDegrees;
  const moonRadiusPixels = geometry.moonRadiusDegrees * pixelsPerDegree;
  const separationPixels = geometry.separationDegrees * pixelsPerDegree;
  const moonCenterX = CENTER_X + geometry.directionX * separationPixels;
  const moonCenterY = CENTER_Y + geometry.directionY * separationPixels;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Eclipse contact</Text>
          <Text style={styles.phase}>{phase.label}</Text>
        </View>
        <Text style={styles.obscuration}>
          {(sky.obscuration * 100).toFixed(2)}%
        </Text>
      </View>
      <Svg
        accessibilityLabel={`To-scale Sun and Moon contact: ${phase.label}`}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
      >
        <Rect fill="#07152a" height={HEIGHT} width={WIDTH} />
        <Circle
          cx={CENTER_X}
          cy={CENTER_Y}
          fill={theme.color.accent}
          opacity={0.14}
          r={SUN_RADIUS_PIXELS * 1.8}
        />
        <Circle
          cx={CENTER_X}
          cy={CENTER_Y}
          fill="#ffe69a"
          r={SUN_RADIUS_PIXELS}
        />
        <Circle
          cx={moonCenterX}
          cy={moonCenterY}
          fill="#05080c"
          r={moonRadiusPixels}
          stroke="#d9e2ea"
          strokeWidth={1}
        />
      </Svg>
      <Text style={styles.note}>
        To-scale angular view · glow is decorative
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.space.medium,
    justifyContent: "space-between",
    padding: theme.space.medium,
  },
  eyebrow: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  phase: {
    color: theme.color.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: theme.space.xsmall,
  },
  obscuration: {
    color: theme.color.accent,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    fontWeight: "900",
  },
  note: {
    color: theme.color.muted,
    fontSize: 11,
    padding: theme.space.small,
    textAlign: "center",
  },
});
