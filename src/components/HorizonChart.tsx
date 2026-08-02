import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Text as SvgText } from "react-native-svg";

import type { HorizonProfile } from "../domain/horizon";
import { theme } from "../styles/theme";

interface HorizonChartProps {
  profile: HorizonProfile;
  sunAltitudeDegrees: number;
}

const WIDTH = 360;
const HEIGHT = 180;
const PAD_LEFT = 35;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

export const HorizonChart = ({
  profile,
  sunAltitudeDegrees,
}: HorizonChartProps) => {
  const maximumDistance = Math.max(
    1,
    ...profile.samples.map((sample) => sample.distanceKm),
  );
  const terrainAngles = profile.samples.map(
    (sample) => sample.apparentTerrainAngleDegrees,
  );
  const minimumAngle = Math.min(-1, ...terrainAngles, sunAltitudeDegrees);
  const maximumAngle = Math.max(1, ...terrainAngles, sunAltitudeDegrees);
  const angleRange = maximumAngle - minimumAngle;
  const x = (distance: number): number =>
    PAD_LEFT +
    (distance / maximumDistance) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (angle: number): number =>
    PAD_TOP +
    ((maximumAngle - angle) / angleRange) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const terrainPoints = [
    `${x(0)},${y(0)}`,
    ...profile.samples.map(
      (sample) => `${x(sample.distanceKm)},${y(sample.apparentTerrainAngleDegrees)}`,
    ),
  ].join(" ");

  return (
    <View style={styles.container}>
      <Svg
        accessibilityLabel="Terrain horizon profile with Sun altitude reference"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
      >
        <Line
          stroke={theme.color.border}
          strokeWidth={1}
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={y(0)}
          y2={y(0)}
        />
        <Line
          stroke={theme.color.accent}
          strokeDasharray="7 5"
          strokeWidth={2}
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={y(sunAltitudeDegrees)}
          y2={y(sunAltitudeDegrees)}
        />
        <Polyline
          fill="none"
          points={terrainPoints}
          stroke={theme.color.sky}
          strokeLinejoin="round"
          strokeWidth={3}
        />
        <SvgText
          fill={theme.color.accent}
          fontSize={10}
          x={PAD_LEFT + 4}
          y={Math.max(12, y(sunAltitudeDegrees) - 5)}
        >
          Sun {sunAltitudeDegrees.toFixed(1)}°
        </SvgText>
        <SvgText
          fill={theme.color.muted}
          fontSize={10}
          x={2}
          y={y(0) + 3}
        >
          0°
        </SvgText>
        <SvgText
          fill={theme.color.muted}
          fontSize={10}
          textAnchor="end"
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 7}
        >
          {maximumDistance} km
        </SvgText>
      </Svg>
      <View style={styles.legend}>
        <Text style={styles.terrain}>— sampled terrain</Text>
        <Text style={styles.sun}>- - Sun at maximum</Text>
      </View>
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
    padding: theme.space.small,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.medium,
    paddingHorizontal: theme.space.small,
    paddingBottom: theme.space.small,
  },
  terrain: {
    color: theme.color.sky,
    fontSize: 12,
  },
  sun: {
    color: theme.color.accent,
    fontSize: 12,
  },
});
