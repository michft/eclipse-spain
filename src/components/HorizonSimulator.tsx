import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import type { ContactRecord } from "../domain/audioTimeline";
import {
  calculateObserverSky,
  CONTACT_IDS,
  type ObserverSkyState,
} from "../domain/eclipse";
import type { GeoPoint } from "../domain/geo";
import type { ElevationProfileResult } from "../services/openMeteo";
import { theme } from "../styles/theme";
import { ActionButton } from "./ActionButton";
import { TimelineSlider } from "./TimelineSlider";

interface HorizonSimulatorProps {
  contacts: ContactRecord;
  elevation: ElevationProfileResult;
  location: GeoPoint;
}

const WIDTH = 720;
const HEIGHT = 360;
const PAD_LEFT = 42;
const PAD_RIGHT = 20;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;
const PATH_SAMPLES = 48;

const azimuthOffset = (azimuth: number, center: number): number =>
  ((azimuth - center + 540) % 360) - 180;

const normalizeAzimuth = (azimuth: number): number =>
  ((azimuth % 360) + 360) % 360;

const formatUtc = (milliseconds: number): string =>
  new Date(milliseconds).toISOString().slice(11, 19) + " UTC";

const interpolateTerrain = (
  samples: ElevationProfileResult["skyline"]["samples"],
  offsetDegrees: number,
): number => {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last) {
    return 0;
  }
  if (offsetDegrees <= first.azimuthOffsetDegrees) {
    return first.terrainAngleDegrees;
  }
  if (offsetDegrees >= last.azimuthOffsetDegrees) {
    return last.terrainAngleDegrees;
  }
  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    const left = samples[index - 1];
    if (!left || !right || offsetDegrees > right.azimuthOffsetDegrees) {
      continue;
    }
    const span = right.azimuthOffsetDegrees - left.azimuthOffsetDegrees;
    const fraction = (offsetDegrees - left.azimuthOffsetDegrees) / span;
    return (
      left.terrainAngleDegrees +
      fraction * (right.terrainAngleDegrees - left.terrainAngleDegrees)
    );
  }
  return last.terrainAngleDegrees;
};

export const HorizonSimulator = ({
  contacts,
  elevation,
  location,
}: HorizonSimulatorProps) => {
  const startMilliseconds = Date.parse(contacts.c1?.utc ?? "");
  const endMilliseconds = Date.parse(contacts.c4?.utc ?? "");
  const maximumMilliseconds = Date.parse(
    contacts.maximum?.utc ?? contacts.c1?.utc ?? "",
  );
  const [simulatedMilliseconds, setSimulatedMilliseconds] = useState(
    maximumMilliseconds,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);

  useEffect(() => {
    setPlaying(false);
    setSimulatedMilliseconds(maximumMilliseconds);
  }, [maximumMilliseconds]);

  useEffect(() => {
    if (!playing || !Number.isFinite(endMilliseconds)) {
      return;
    }
    const timer = setInterval(() => {
      setSimulatedMilliseconds((current) =>
        Math.min(endMilliseconds, current + 100 * speed),
      );
    }, 100);
    return () => clearInterval(timer);
  }, [endMilliseconds, playing, speed]);

  useEffect(() => {
    if (playing && simulatedMilliseconds >= endMilliseconds) {
      setPlaying(false);
    }
  }, [endMilliseconds, playing, simulatedMilliseconds]);

  const path = useMemo(() => {
    if (!Number.isFinite(startMilliseconds) || !Number.isFinite(endMilliseconds)) {
      return [];
    }
    return Array.from({ length: PATH_SAMPLES + 1 }, (_, index) => {
      const milliseconds =
        startMilliseconds +
        ((endMilliseconds - startMilliseconds) * index) / PATH_SAMPLES;
      return calculateObserverSky(
        location,
        new Date(milliseconds),
        elevation.observerElevationMeters,
      );
    }).filter((state): state is ObserverSkyState => state !== null);
  }, [elevation.observerElevationMeters, endMilliseconds, location, startMilliseconds]);

  const current = calculateObserverSky(
    location,
    new Date(simulatedMilliseconds),
    elevation.observerElevationMeters,
  );
  if (
    !current ||
    !Number.isFinite(startMilliseconds) ||
    !Number.isFinite(endMilliseconds)
  ) {
    return <Text style={styles.warning}>Observer-sky simulation is unavailable.</Text>;
  }

  const { skyline } = elevation;
  const halfField = skyline.fieldOfViewDegrees / 2;
  const maximumAltitude = Math.min(
    90,
    Math.max(
      20,
      ...path.flatMap((state) => [
        state.sun.altitudeDegrees,
        state.moon.altitudeDegrees,
      ]),
      ...skyline.samples.map((sample) => sample.terrainAngleDegrees),
    ) + 4,
  );
  const minimumAltitude = -3;
  const x = (offset: number): number =>
    PAD_LEFT +
    ((offset + halfField) / skyline.fieldOfViewDegrees) *
      (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (altitude: number): number =>
    PAD_TOP +
    ((maximumAltitude - altitude) / (maximumAltitude - minimumAltitude)) *
      (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const pointsFor = (body: "sun" | "moon"): string =>
    path
      .map((state) => ({
        altitude: state[body].altitudeDegrees,
        offset: azimuthOffset(
          state[body].azimuthDegrees,
          skyline.centerAzimuthDegrees,
        ),
      }))
      .filter((point) => Math.abs(point.offset) <= halfField)
      .map((point) => `${x(point.offset)},${y(point.altitude)}`)
      .join(" ");
  const terrainPoints = [
    `${x(-halfField)},${y(minimumAltitude)}`,
    ...skyline.samples.map(
      (sample) =>
        `${x(sample.azimuthOffsetDegrees)},${y(sample.terrainAngleDegrees)}`,
    ),
    `${x(halfField)},${y(minimumAltitude)}`,
  ].join(" ");
  const sunOffset = azimuthOffset(
    current.sun.azimuthDegrees,
    skyline.centerAzimuthDegrees,
  );
  const moonOffset = azimuthOffset(
    current.moon.azimuthDegrees,
    skyline.centerAzimuthDegrees,
  );
  const pixelsPerDegree =
    (HEIGHT - PAD_TOP - PAD_BOTTOM) / (maximumAltitude - minimumAltitude);
  const sunRadius = Math.max(7, current.sun.angularRadiusDegrees * pixelsPerDegree);
  const moonRadius = Math.max(7, current.moon.angularRadiusDegrees * pixelsPerDegree);
  const terrainAtSun = interpolateTerrain(skyline.samples, sunOffset);
  const clearance = current.sun.altitudeDegrees - terrainAtSun;

  return (
    <View style={styles.container}>
      <View style={styles.liveMetrics}>
        <View>
          <Text style={styles.time}>{formatUtc(simulatedMilliseconds)}</Text>
          <Text style={styles.muted}>{(current.obscuration * 100).toFixed(2)}% obscured</Text>
        </View>
        <View style={styles.rightMetrics}>
          <Text style={styles.metricText}>
            Sun {current.sun.azimuthDegrees.toFixed(1)}° az · {current.sun.altitudeDegrees.toFixed(1)}° alt
          </Text>
          <Text style={[styles.metricText, clearance < 0 && styles.blocked]}>
            Sampled terrain clearance {clearance.toFixed(1)}°
          </Text>
        </View>
      </View>
      <View style={styles.skyFrame}>
        <Svg
          accessibilityLabel="Animated observer sky showing Sun and Moon above the sampled terrain horizon"
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
        >
          <Defs>
            <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#07152a" />
              <Stop offset="0.7" stopColor="#245070" />
              <Stop offset="1" stopColor="#d28a45" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#sky)" height={HEIGHT} width={WIDTH} />
          {[0, 10, 20, 40, 60, 80]
            .filter((altitude) => altitude <= maximumAltitude)
            .map((altitude) => (
              <Line
                key={altitude}
                opacity={0.3}
                stroke="#d9ecff"
                strokeWidth={1}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y(altitude)}
                y2={y(altitude)}
              />
            ))}
          <Polyline
            fill="none"
            opacity={0.55}
            points={pointsFor("moon")}
            stroke="#d9e2ea"
            strokeDasharray="3 7"
            strokeWidth={2}
          />
          <Polyline
            fill="none"
            opacity={0.8}
            points={pointsFor("sun")}
            stroke={theme.color.accent}
            strokeDasharray="7 6"
            strokeWidth={2}
          />
          {Math.abs(sunOffset) <= halfField ? (
            <>
              <Circle
                cx={x(sunOffset)}
                cy={y(current.sun.altitudeDegrees)}
                fill={theme.color.accent}
                opacity={0.18}
                r={sunRadius * 2.6}
              />
              <Circle
                cx={x(sunOffset)}
                cy={y(current.sun.altitudeDegrees)}
                fill="#ffe69a"
                r={sunRadius}
              />
            </>
          ) : null}
          {Math.abs(moonOffset) <= halfField ? (
            <Circle
              cx={x(moonOffset)}
              cy={y(current.moon.altitudeDegrees)}
              fill="#05080c"
              r={moonRadius}
              stroke="#d9e2ea"
              strokeWidth={1}
            />
          ) : null}
          <Polygon fill="#081018" points={terrainPoints} />
          <Polyline
            fill="none"
            points={skyline.samples
              .map(
                (sample) =>
                  `${x(sample.azimuthOffsetDegrees)},${y(sample.terrainAngleDegrees)}`,
              )
              .join(" ")}
            stroke={theme.color.sky}
            strokeWidth={2}
          />
          <SvgText fill="#d9ecff" fontSize={11} x={4} y={y(0) + 4}>0°</SvgText>
          <SvgText fill="#d9ecff" fontSize={11} x={PAD_LEFT} y={HEIGHT - 10}>
            {normalizeAzimuth(skyline.centerAzimuthDegrees - halfField).toFixed(0)}° az
          </SvgText>
          <SvgText
            fill="#d9ecff"
            fontSize={11}
            textAnchor="end"
            x={WIDTH - PAD_RIGHT}
            y={HEIGHT - 10}
          >
            {normalizeAzimuth(skyline.centerAzimuthDegrees + halfField).toFixed(0)}° az
          </SvgText>
        </Svg>
      </View>
      <TimelineSlider
        maximum={endMilliseconds}
        minimum={startMilliseconds}
        onChange={(value) => {
          setPlaying(false);
          setSimulatedMilliseconds(value);
        }}
        value={simulatedMilliseconds}
      />
      <View style={styles.controls}>
        <ActionButton onPress={() => setPlaying((currentPlaying) => !currentPlaying)}>
          {playing ? "Pause" : "Play"}
        </ActionButton>
        <ActionButton
          onPress={() =>
            setSimulatedMilliseconds((currentTime) =>
              Math.max(startMilliseconds, currentTime - 60_000),
            )
          }
          secondary
        >
          −1 min
        </ActionButton>
        <ActionButton
          onPress={() =>
            setSimulatedMilliseconds((currentTime) =>
              Math.min(endMilliseconds, currentTime + 60_000),
            )
          }
          secondary
        >
          +1 min
        </ActionButton>
        {[60, 300, 600].map((candidateSpeed) => (
          <ActionButton
            key={candidateSpeed}
            onPress={() => setSpeed(candidateSpeed)}
            secondary={speed !== candidateSpeed}
          >
            {candidateSpeed}×
          </ActionButton>
        ))}
      </View>
      <View style={styles.controls}>
        {CONTACT_IDS.map((contactId) => {
          const contact = contacts[contactId];
          return contact ? (
            <ActionButton
              key={contactId}
              onPress={() => {
                setPlaying(false);
                setSimulatedMilliseconds(Date.parse(contact.utc));
              }}
              secondary
            >
              {contactId.toUpperCase()}
            </ActionButton>
          ) : null;
        })}
      </View>
      <Text style={styles.disclaimer}>
        Terrain uses a 90 m DEM sampled across this 80° view. Sun and Moon positions
        are calculated for the selected UTC. Disc sizes are enlarged for legibility;
        trees, buildings, haze, cloud, and temporary obstructions are not modelled.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: theme.space.medium },
  liveMetrics: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium, justifyContent: "space-between" },
  time: { color: theme.color.accent, fontSize: 23, fontVariant: ["tabular-nums"], fontWeight: "900" },
  muted: { color: theme.color.muted, fontSize: 12 },
  rightMetrics: { alignItems: "flex-end", gap: theme.space.xsmall },
  metricText: { color: theme.color.text, fontSize: 13, fontVariant: ["tabular-nums"] },
  blocked: { color: theme.color.warning },
  skyFrame: { borderColor: theme.color.border, borderRadius: theme.radius.medium, borderWidth: 1, overflow: "hidden" },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.small },
  disclaimer: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
  warning: { color: theme.color.warning, fontSize: 14 },
});
