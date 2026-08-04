import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
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
  type LocalEclipseCircumstances,
  type ObserverSkyState,
} from "../domain/eclipse";
import type { GeoPoint } from "../domain/geo";
import {
  eclipseDiscGeometry,
  eclipsePhaseAt,
} from "../domain/eclipseOverlay";
import type { ElevationProfileResult } from "../services/openMeteo";
import { theme } from "../styles/theme";
import { ActionButton } from "./ActionButton";
import { EclipseContactOverlay } from "./EclipseContactOverlay";
import { HorizonZoomSurface } from "./HorizonZoomSurface";
import { TimelineSlider } from "./TimelineSlider";

interface HorizonSimulatorProps {
  contacts: ContactRecord;
  elevation: ElevationProfileResult;
  kind: LocalEclipseCircumstances["kind"];
  location: GeoPoint;
}

const WIDTH = 720;
const HEIGHT = 360;
const PAD_LEFT = 42;
const PAD_RIGHT = 20;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;
const PATH_SAMPLES = 48;
const HOUR_MILLISECONDS = 60 * 60 * 1000;
const CONTACT_CONTEXT_MILLISECONDS = 30 * 60 * 1000;
const ALTITUDE_GUIDES = [0, 10, 20, 40, 60, 80] as const;
const DEFAULT_FIELD_OF_VIEW_DEGREES = 45;
const MINIMUM_FIELD_OF_VIEW_DEGREES = 30;
const MAXIMUM_FIELD_OF_VIEW_DEGREES = 180;
const FIELD_OF_VIEW_STEP_DEGREES = 5;
const CARDINAL_POINTS = [
  { bearing: 0, label: "N" },
  { bearing: 90, label: "E" },
  { bearing: 180, label: "S" },
  { bearing: 270, label: "W" },
] as const;

const azimuthOffset = (azimuth: number, center: number): number =>
  ((azimuth - center + 540) % 360) - 180;

const normalizeAzimuth = (azimuth: number): number =>
  ((azimuth % 360) + 360) % 360;

const formatUtc = (milliseconds: number): string =>
  new Date(milliseconds).toISOString().slice(11, 19) + " UTC";

const formatUtcHour = (milliseconds: number): string =>
  new Date(milliseconds).toISOString().slice(11, 16) + "Z";

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
  kind,
  location,
}: HorizonSimulatorProps) => {
  const startMilliseconds = Date.parse(contacts.c1?.utc ?? "");
  const endMilliseconds = Date.parse(contacts.c4?.utc ?? "");
  const simulationStartMilliseconds =
    startMilliseconds - CONTACT_CONTEXT_MILLISECONDS;
  const simulationEndMilliseconds =
    endMilliseconds + CONTACT_CONTEXT_MILLISECONDS;
  const maximumMilliseconds = Date.parse(
    contacts.maximum?.utc ?? contacts.c1?.utc ?? "",
  );
  const [simulatedMilliseconds, setSimulatedMilliseconds] = useState(
    maximumMilliseconds,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const [fieldOfViewDegrees, setFieldOfViewDegrees] = useState(
    Math.min(DEFAULT_FIELD_OF_VIEW_DEGREES, elevation.skyline.fieldOfViewDegrees),
  );

  useEffect(() => {
    setPlaying(false);
    setSimulatedMilliseconds(maximumMilliseconds);
  }, [maximumMilliseconds]);

  useEffect(() => {
    setFieldOfViewDegrees(
      Math.min(DEFAULT_FIELD_OF_VIEW_DEGREES, elevation.skyline.fieldOfViewDegrees),
    );
  }, [elevation.skyline.centerAzimuthDegrees, elevation.skyline.fieldOfViewDegrees]);

  useEffect(() => {
    if (!playing || !Number.isFinite(simulationEndMilliseconds)) {
      return;
    }
    const timer = setInterval(() => {
      setSimulatedMilliseconds((current) =>
        Math.min(simulationEndMilliseconds, current + 100 * speed),
      );
    }, 100);
    return () => clearInterval(timer);
  }, [playing, simulationEndMilliseconds, speed]);

  useEffect(() => {
    if (playing && simulatedMilliseconds >= simulationEndMilliseconds) {
      setPlaying(false);
    }
  }, [playing, simulatedMilliseconds, simulationEndMilliseconds]);

  const path = useMemo(() => {
    if (!Number.isFinite(startMilliseconds) || !Number.isFinite(endMilliseconds)) {
      return [];
    }
    const sampledMilliseconds = Array.from(
      { length: PATH_SAMPLES + 1 },
      (_, index) =>
        simulationStartMilliseconds +
        ((simulationEndMilliseconds - simulationStartMilliseconds) * index) /
          PATH_SAMPLES,
    );
    const pathMilliseconds = [
      ...new Set([
        ...sampledMilliseconds,
        simulationStartMilliseconds,
        startMilliseconds,
        endMilliseconds,
        simulationEndMilliseconds,
      ]),
    ].sort((left, right) => left - right);
    return pathMilliseconds.map((milliseconds) => {
      const state = calculateObserverSky(
        location,
        new Date(milliseconds),
        elevation.observerElevationMeters,
      );
      return state ? { milliseconds, state } : null;
    }).filter(
      (sample): sample is { milliseconds: number; state: ObserverSkyState } =>
        sample !== null,
    );
  }, [
    elevation.observerElevationMeters,
    location,
    simulationEndMilliseconds,
    simulationStartMilliseconds,
  ]);

  const hourlyPath = useMemo(() => {
    if (!Number.isFinite(startMilliseconds) || !Number.isFinite(endMilliseconds)) {
      return [];
    }
    const firstHourMilliseconds =
      Math.ceil(simulationStartMilliseconds / HOUR_MILLISECONDS) *
      HOUR_MILLISECONDS;
    const hourCount = Math.max(
      0,
      Math.floor(
        (simulationEndMilliseconds - firstHourMilliseconds) / HOUR_MILLISECONDS,
      ) + 1,
    );
    return Array.from({ length: hourCount }, (_, index) => {
      const milliseconds = firstHourMilliseconds + index * HOUR_MILLISECONDS;
      const state = calculateObserverSky(
        location,
        new Date(milliseconds),
        elevation.observerElevationMeters,
      );
      return state ? { milliseconds, state } : null;
    }).filter(
      (marker): marker is { milliseconds: number; state: ObserverSkyState } =>
        marker !== null,
    );
  }, [
    elevation.observerElevationMeters,
    endMilliseconds,
    location,
    simulationEndMilliseconds,
    simulationStartMilliseconds,
    startMilliseconds,
  ]);

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
  const maximumFieldOfViewDegrees = Math.min(
    MAXIMUM_FIELD_OF_VIEW_DEGREES,
    skyline.fieldOfViewDegrees,
  );
  const halfField = fieldOfViewDegrees / 2;
  const changeFieldOfView = (nextFieldOfViewDegrees: number): void => {
    setFieldOfViewDegrees(
      Math.max(
        MINIMUM_FIELD_OF_VIEW_DEGREES,
        Math.min(maximumFieldOfViewDegrees, nextFieldOfViewDegrees),
      ),
    );
  };
  const maximumAltitude = Math.min(
    90,
    Math.max(
      20,
      ...path.flatMap(({ state }) => [
        state.sun.altitudeDegrees,
        state.moon.altitudeDegrees,
      ]),
      ...skyline.samples.map((sample) => sample.terrainAngleDegrees),
    ) + 4,
  );
  const minimumAltitude = -3;
  const x = (offset: number): number =>
    PAD_LEFT +
    ((offset + halfField) / fieldOfViewDegrees) *
      (WIDTH - PAD_LEFT - PAD_RIGHT);
  const y = (altitude: number): number =>
    PAD_TOP +
    ((maximumAltitude - altitude) / (maximumAltitude - minimumAltitude)) *
      (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const pointsFor = (
    body: "sun" | "moon",
    segmentStartMilliseconds: number,
    segmentEndMilliseconds: number,
  ): string =>
    path
      .filter(
        (sample) =>
          sample.milliseconds >= segmentStartMilliseconds &&
          sample.milliseconds <= segmentEndMilliseconds,
      )
      .map(({ state }) => ({
        altitude: state[body].altitudeDegrees,
        offset: azimuthOffset(
          state[body].azimuthDegrees,
          skyline.centerAzimuthDegrees,
        ),
      }))
      .filter((point) => Math.abs(point.offset) <= halfField)
      .map((point) => `${x(point.offset)},${y(point.altitude)}`)
      .join(" ");
  const pathSegments = [
    {
      end: startMilliseconds,
      id: "before-c1",
      label: "before C1",
      start: simulationStartMilliseconds,
      stroke: theme.color.text,
    },
    {
      end: endMilliseconds,
      id: "eclipse",
      label: "C1 to C4 eclipse",
      start: startMilliseconds,
      stroke: theme.color.accentStrong,
    },
    {
      end: simulationEndMilliseconds,
      id: "after-c4",
      label: "after C4",
      start: endMilliseconds,
      stroke: theme.color.text,
    },
  ] as const;
  const visibleHourMarkers = hourlyPath.flatMap((marker) => {
    const sunOffset = azimuthOffset(
      marker.state.sun.azimuthDegrees,
      skyline.centerAzimuthDegrees,
    );
    const moonOffset = azimuthOffset(
      marker.state.moon.azimuthDegrees,
      skyline.centerAzimuthDegrees,
    );
    const labelOffset = (sunOffset + moonOffset) / 2;
    return Math.abs(labelOffset) <= halfField
      ? [{ ...marker, labelOffset, moonOffset, sunOffset }]
      : [];
  });
  const visibleTerrainSamples = [
    {
      azimuthOffsetDegrees: -halfField,
      terrainAngleDegrees: interpolateTerrain(skyline.samples, -halfField),
    },
    ...skyline.samples.filter(
      (sample) => Math.abs(sample.azimuthOffsetDegrees) < halfField,
    ),
    {
      azimuthOffsetDegrees: halfField,
      terrainAngleDegrees: interpolateTerrain(skyline.samples, halfField),
    },
  ];
  const terrainPoints = [
    `${x(-halfField)},${y(minimumAltitude)}`,
    ...visibleTerrainSamples.map(
      (sample) =>
        `${x(sample.azimuthOffsetDegrees)},${y(sample.terrainAngleDegrees)}`,
    ),
    `${x(halfField)},${y(minimumAltitude)}`,
  ].join(" ");
  const sunOffset = azimuthOffset(
    current.sun.azimuthDegrees,
    skyline.centerAzimuthDegrees,
  );
  const verticalPixelsPerDegree =
    (HEIGHT - PAD_TOP - PAD_BOTTOM) / (maximumAltitude - minimumAltitude);
  const horizontalPixelsPerAzimuthDegree =
    (WIDTH - PAD_LEFT - PAD_RIGHT) / fieldOfViewDegrees;
  const horizontalPixelsPerAngularDegree =
    horizontalPixelsPerAzimuthDegree /
    Math.max(0.05, Math.abs(Math.cos((current.sun.altitudeDegrees * Math.PI) / 180)));
  const phase = eclipsePhaseAt(contacts, kind, simulatedMilliseconds);
  const discGeometry = eclipseDiscGeometry(current);
  const sunX = x(sunOffset);
  const sunY = y(current.sun.altitudeDegrees);
  const renderedMoonX =
    sunX +
    discGeometry.directionX *
      discGeometry.separationDegrees *
      horizontalPixelsPerAngularDegree;
  const renderedMoonY =
    sunY +
    discGeometry.directionY *
      discGeometry.separationDegrees *
      verticalPixelsPerDegree;
  const sunRadiusX =
    current.sun.angularRadiusDegrees * horizontalPixelsPerAngularDegree;
  const sunRadiusY = current.sun.angularRadiusDegrees * verticalPixelsPerDegree;
  const moonRadiusX =
    current.moon.angularRadiusDegrees * horizontalPixelsPerAngularDegree;
  const moonRadiusY = current.moon.angularRadiusDegrees * verticalPixelsPerDegree;
  const terrainAtSun = interpolateTerrain(skyline.samples, sunOffset);
  const clearance = current.sun.altitudeDegrees - terrainAtSun;
  const visibleCardinals = CARDINAL_POINTS.flatMap((cardinal) => {
    const offset = azimuthOffset(
      cardinal.bearing,
      skyline.centerAzimuthDegrees,
    );
    return Math.abs(offset) <= halfField ? [{ ...cardinal, offset }] : [];
  });

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
      <EclipseContactOverlay phase={phase} sky={current} />
      <View accessibilityLabel="Chart line labels" style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.sunPathLine]} />
          <Text style={styles.legendLabel}>Sun path</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.moonPathLine]} />
          <Text style={styles.legendLabel}>Moon path</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.outsidePathLine]} />
          <Text style={styles.legendLabel}>Outside eclipse · white</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.eclipsePathLine]} />
          <Text style={styles.legendLabel}>C1–C4 eclipse · orange</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.terrainLine]} />
          <Text style={styles.legendLabel}>Terrain skyline</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.horizonLine]} />
          <Text style={styles.legendLabel}>Astronomical horizon (0° altitude)</Text>
        </View>
      </View>
      <View style={styles.fieldOfViewHeader}>
        <Text style={styles.controlLabel}>Field of view</Text>
        <Text style={styles.fieldOfViewValue}>{fieldOfViewDegrees.toFixed(0)}°</Text>
      </View>
      <TimelineSlider
        accessibilityLabel="Horizon field of view"
        maximum={maximumFieldOfViewDegrees}
        minimum={MINIMUM_FIELD_OF_VIEW_DEGREES}
        onChange={changeFieldOfView}
        step={FIELD_OF_VIEW_STEP_DEGREES}
        value={fieldOfViewDegrees}
      />
      <Text style={styles.helperText}>
        Drag the control, or focus the chart then scroll, to zoom from 30° to 180°.
      </Text>
      <View accessibilityLabel="Cardinal bearings" style={styles.compassKey}>
        {CARDINAL_POINTS.map((cardinal) => (
          <Text key={cardinal.label} style={styles.compassLabel}>
            {cardinal.label} {cardinal.bearing}°
          </Text>
        ))}
      </View>
      <View style={styles.chartBleed}>
        <HorizonZoomSurface
          onZoomBy={(degrees) => changeFieldOfView(fieldOfViewDegrees + degrees)}
        >
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
          {ALTITUDE_GUIDES
            .filter((altitude) => altitude <= maximumAltitude)
            .map((altitude) => (
              <G key={altitude}>
                <Line
                  opacity={altitude === 0 ? 0.8 : 0.3}
                  stroke="#d9ecff"
                  strokeWidth={altitude === 0 ? 2 : 1}
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={y(altitude)}
                  y2={y(altitude)}
                />
                <SvgText fill="#d9ecff" fontSize={11} textAnchor="end" x={PAD_LEFT - 6} y={y(altitude) + 4}>
                  {altitude}°
                </SvgText>
              </G>
            ))}
          {(["sun", "moon"] as const).flatMap((body) =>
            pathSegments.map((segment) => (
              <Polyline
                accessibilityLabel={`${body === "sun" ? "Sun" : "Moon"} ${segment.label} path`}
                fill="none"
                key={`${body}:${segment.id}`}
                opacity={body === "sun" ? 0.9 : 0.65}
                points={pointsFor(body, segment.start, segment.end)}
                stroke={segment.stroke}
                strokeWidth={2}
                {...(body === "moon" ? { strokeDasharray: "3 7" } : {})}
              />
            )),
          )}
          {visibleHourMarkers.map((marker) => {
            const sunX = x(marker.sunOffset);
            const sunY = y(marker.state.sun.altitudeDegrees);
            const moonX = x(marker.moonOffset);
            const moonY = y(marker.state.moon.altitudeDegrees);
            return (
              <G key={`utc-hour:${marker.milliseconds}`}>
                <Line
                  opacity={0.65}
                  stroke={theme.color.text}
                  strokeWidth={1}
                  x1={sunX}
                  x2={moonX}
                  y1={sunY}
                  y2={moonY}
                />
                <Circle
                  cx={sunX}
                  cy={sunY}
                  fill={
                    marker.milliseconds < startMilliseconds ||
                    marker.milliseconds > endMilliseconds
                      ? theme.color.text
                      : theme.color.accentStrong
                  }
                  r={3}
                />
                <Circle
                  cx={moonX}
                  cy={moonY}
                  fill={
                    marker.milliseconds < startMilliseconds ||
                    marker.milliseconds > endMilliseconds
                      ? theme.color.text
                      : theme.color.accentStrong
                  }
                  r={3}
                />
                <SvgText
                  fill={
                    marker.milliseconds < startMilliseconds ||
                    marker.milliseconds > endMilliseconds
                      ? theme.color.text
                      : theme.color.accentStrong
                  }
                  fontSize={11}
                  fontWeight="bold"
                  textAnchor="middle"
                  x={x(marker.labelOffset)}
                  y={Math.max(PAD_TOP + 12, Math.min(sunY, moonY) - 8)}
                >
                  {formatUtcHour(marker.milliseconds)}
                </SvgText>
              </G>
            );
          })}
          {Math.abs(sunOffset) <= halfField ? (
            <>
              <Ellipse
                cx={sunX}
                cy={sunY}
                fill={theme.color.accent}
                opacity={0.18}
                rx={sunRadiusX * 2.6}
                ry={sunRadiusY * 2.6}
              />
              <Ellipse
                cx={sunX}
                cy={sunY}
                fill="#ffe69a"
                rx={sunRadiusX}
                ry={sunRadiusY}
              />
              <Ellipse
                cx={renderedMoonX}
                cy={renderedMoonY}
                fill="#05080c"
                rx={moonRadiusX}
                ry={moonRadiusY}
                stroke="#d9e2ea"
                strokeWidth={0.5}
              />
            </>
          ) : null}
          <Polygon fill="#081018" points={terrainPoints} />
          {visibleCardinals.map((cardinal) => (
            <G key={cardinal.label}>
              <Line
                opacity={0.22}
                stroke="#f7f2df"
                strokeWidth={1}
                x1={x(cardinal.offset)}
                x2={x(cardinal.offset)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
              />
              <SvgText
                fill="#f7f2df"
                fontSize={13}
                fontWeight="bold"
                textAnchor="middle"
                x={x(cardinal.offset)}
                y={PAD_TOP + 15}
              >
                {cardinal.label} · {cardinal.bearing}°
              </SvgText>
            </G>
          ))}
          <Polyline
            fill="none"
            points={visibleTerrainSamples
              .map(
                (sample) =>
                  `${x(sample.azimuthOffsetDegrees)},${y(sample.terrainAngleDegrees)}`,
              )
              .join(" ")}
            stroke={theme.color.sky}
            strokeWidth={2}
          />
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
        </HorizonZoomSurface>
      </View>
      <Text style={styles.controlLabel}>Simulation time</Text>
      <View
        accessibilityLabel="Playback phases: white before C1, orange from C1 to C4, white after C4"
        style={styles.playbackTrack}
      >
        {pathSegments.map((segment) => (
          <View
            key={`playback:${segment.id}`}
            style={[
              styles.playbackTrackSegment,
              { backgroundColor: segment.stroke, flex: segment.end - segment.start },
            ]}
          />
        ))}
      </View>
      <View style={styles.playbackLabels}>
        <Text style={[styles.playbackLabel, styles.playbackLabelLeft]}>
          Before C1 · 30 min
        </Text>
        <Text style={[styles.playbackLabel, styles.playbackLabelCenter]}>
          C1–C4 eclipse
        </Text>
        <Text style={[styles.playbackLabel, styles.playbackLabelRight]}>
          After C4 · 30 min
        </Text>
      </View>
      <TimelineSlider
        accessibilityLabel="Horizon simulation time"
        maximum={simulationEndMilliseconds}
        minimum={simulationStartMilliseconds}
        onChange={(value) => {
          setPlaying(false);
          setSimulatedMilliseconds(value);
        }}
        value={simulatedMilliseconds}
      />
      <View style={styles.timeBounds}>
        <Text style={styles.timeBound}>
          {formatUtc(simulationStartMilliseconds)} · 30 min before C1
        </Text>
        <Text style={styles.timeBound}>
          {formatUtc(simulationEndMilliseconds)} · 30 min after C4
        </Text>
      </View>
      <Text style={styles.controlLabel}>Playback controls</Text>
      <View style={styles.controls}>
        <ActionButton onPress={() => setPlaying((currentPlaying) => !currentPlaying)}>
          {playing ? "Pause" : "Play"}
        </ActionButton>
        <ActionButton
          onPress={() =>
            setSimulatedMilliseconds((currentTime) =>
              Math.max(simulationStartMilliseconds, currentTime - 60_000),
            )
          }
          secondary
        >
          −1 min
        </ActionButton>
        <ActionButton
          onPress={() =>
            setSimulatedMilliseconds((currentTime) =>
              Math.min(simulationEndMilliseconds, currentTime + 60_000),
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
      <Text style={styles.controlLabel}>Jump to eclipse contact</Text>
      <View style={styles.controls}>
        <ActionButton
          onPress={() => {
            setPlaying(false);
            setSimulatedMilliseconds(simulationStartMilliseconds);
          }}
          secondary
        >
          Before C1
        </ActionButton>
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
        <ActionButton
          onPress={() => {
            setPlaying(false);
            setSimulatedMilliseconds(simulationEndMilliseconds);
          }}
          secondary
        >
          After C4
        </ActionButton>
      </View>
      <Text style={styles.disclaimer}>
        Terrain uses a 90 m DEM sampled across a 180° view. Sun and Moon positions
        are calculated for the selected UTC. The contact view is to angular scale;
        trees, buildings, haze, cloud, and temporary obstructions are not modelled.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: theme.space.medium, paddingHorizontal: theme.space.medium },
  liveMetrics: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium, justifyContent: "space-between" },
  time: { color: theme.color.accent, fontSize: 23, fontVariant: ["tabular-nums"], fontWeight: "900" },
  muted: { color: theme.color.muted, fontSize: 12 },
  rightMetrics: { alignItems: "flex-end", gap: theme.space.xsmall },
  metricText: { color: theme.color.text, fontSize: 13, fontVariant: ["tabular-nums"] },
  blocked: { color: theme.color.warning },
  chartBleed: { marginHorizontal: -theme.space.medium },
  skyFrame: { borderColor: theme.color.border, borderWidth: 1, borderLeftWidth: 0, borderRightWidth: 0, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium },
  legendItem: { alignItems: "center", flexDirection: "row", gap: theme.space.small },
  legendLine: { borderTopWidth: 2, width: 28 },
  sunPathLine: { borderColor: theme.color.text },
  moonPathLine: { borderColor: theme.color.text, borderStyle: "dotted" },
  outsidePathLine: { borderColor: theme.color.text },
  eclipsePathLine: { borderColor: theme.color.accentStrong },
  terrainLine: { borderColor: theme.color.sky },
  horizonLine: { borderColor: "#d9ecff" },
  legendLabel: { color: theme.color.text, fontSize: 12 },
  fieldOfViewHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  fieldOfViewValue: { color: theme.color.accent, fontSize: 18, fontWeight: "900" },
  helperText: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
  compassKey: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium },
  compassLabel: { color: theme.color.text, fontSize: 12, fontWeight: "700" },
  controlLabel: { color: theme.color.text, fontSize: 14, fontWeight: "800" },
  playbackTrack: { flexDirection: "row", height: 8, overflow: "hidden" },
  playbackTrackSegment: { minWidth: 1 },
  playbackLabels: { flexDirection: "row", justifyContent: "space-between" },
  playbackLabel: { color: theme.color.muted, flex: 1, fontSize: 10 },
  playbackLabelLeft: { textAlign: "left" },
  playbackLabelCenter: { textAlign: "center" },
  playbackLabelRight: { textAlign: "right" },
  timeBounds: { flexDirection: "row", justifyContent: "space-between" },
  timeBound: { color: theme.color.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.small },
  disclaimer: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
  warning: { color: theme.color.warning, fontSize: 14 },
});
