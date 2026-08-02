import { Linking, StyleSheet, Text, View } from "react-native";

import type { LocationFinderState } from "../features/analysis/useLocationFinder";
import type { ObservingLocationCandidate } from "../services/locationFinder";
import { theme } from "../styles/theme";
import { ActionButton } from "./ActionButton";

const modeLabel = {
  rail: "Rail",
  bus: "Bus",
  airport: "Airport",
  ferry: "Ferry",
  parking: "Parking",
} as const;

const duration = (seconds: number | null): string =>
  seconds === null ? "No totality" : `${Math.round(seconds)} s totality`;

interface LocationFinderPanelProps {
  finder: LocationFinderState;
  onFind: () => void;
  onSelect: (candidate: ObservingLocationCandidate) => void;
}

export const LocationFinderPanel = ({ finder, onFind, onSelect }: LocationFinderPanelProps) => (
  <View style={styles.container}>
    <View style={styles.headingRow}>
      <View style={styles.headingText}>
        <Text style={styles.title}>Find observing locations</Text>
        <Text style={styles.muted}>
          Uses the map point as a rough search centre, then checks nearby transport
          anchors against eclipse geometry and sampled terrain.
        </Text>
      </View>
      <ActionButton disabled={finder.state === "loading"} onPress={onFind}>
        {finder.state === "loading" ? "Finding…" : "Find candidates"}
      </ActionButton>
    </View>
    {finder.state === "result" && finder.result.status !== "success" ? (
      <Text style={styles.warning}>{finder.result.reason}</Text>
    ) : null}
    {finder.state === "result" && finder.result.status === "success" ? (
      <View style={styles.list}>
        <Text style={styles.muted}>
          Ranked within {finder.result.value.radiusKm} km. Score = eclipse 15 +
          terrain 40 + centre-line 25 + search proximity 20.
        </Text>
        {finder.result.value.warnings.map((warning) => (
          <Text key={warning} style={styles.warning}>{warning}</Text>
        ))}
        {finder.result.value.candidates.map((candidate, index) => (
          <View key={candidate.id} style={styles.candidate}>
            <View style={styles.rank}>
              <Text style={styles.rankNumber}>{index + 1}</Text>
              <Text style={styles.score}>{candidate.score.total}/100</Text>
            </View>
            <View style={styles.details}>
              <Text style={styles.candidateName}>{candidate.name}</Text>
              <Text style={styles.muted}>
                {modeLabel[candidate.mode]} anchor · {candidate.distanceFromSearchKm.toFixed(1)} km from search point
              </Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>{candidate.eclipseKind.toUpperCase()}</Text>
                <Text style={styles.metric}>{duration(candidate.totalityDurationSeconds)}</Text>
                <Text style={styles.metric}>
                  {candidate.centerLineDistanceKm === null
                    ? "Path —"
                    : `Path ${candidate.centerLineDistanceKm.toFixed(1)} km`}
                </Text>
                <Text style={styles.metric}>
                  {candidate.terrainClearanceDegrees === null
                    ? "Terrain unavailable"
                    : `Terrain ${candidate.terrainClearanceDegrees.toFixed(1)}°`}
                </Text>
              </View>
              <View style={styles.actions}>
                <ActionButton onPress={() => onSelect(candidate)}>
                  Use this location
                </ActionButton>
                <Text
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(candidate.osmUrl)}
                  style={styles.link}
                >
                  OpenStreetMap ↗
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    ) : null}
    <Text style={styles.disclaimer}>
      Candidates are infrastructure anchors, not verified observing sites. Check
      access, safety, local obstructions, and land permission in person.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { borderTopColor: theme.color.border, borderTopWidth: 1, gap: theme.space.medium, paddingTop: theme.space.medium },
  headingRow: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium },
  headingText: { flex: 1, gap: theme.space.xsmall, minWidth: 220 },
  title: { color: theme.color.text, fontSize: 18, fontWeight: "800" },
  muted: { color: theme.color.muted, fontSize: 12, lineHeight: 18 },
  warning: { color: theme.color.warning, fontSize: 13, lineHeight: 19 },
  list: { gap: theme.space.small },
  candidate: { backgroundColor: theme.color.background, borderColor: theme.color.border, borderRadius: theme.radius.medium, borderWidth: 1, flexDirection: "row", gap: theme.space.medium, padding: theme.space.medium },
  rank: { alignItems: "center", gap: theme.space.xsmall, width: 52 },
  rankNumber: { color: theme.color.accent, fontSize: 28, fontWeight: "900" },
  score: { color: theme.color.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  details: { flex: 1, gap: theme.space.small },
  candidateName: { color: theme.color.text, fontSize: 16, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metric: { backgroundColor: theme.color.surfaceRaised, borderRadius: theme.radius.small, color: theme.color.text, fontSize: 11, paddingHorizontal: 8, paddingVertical: 5 },
  actions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: theme.space.medium },
  link: { color: theme.color.sky, fontSize: 13, fontWeight: "700" },
  disclaimer: { color: theme.color.muted, fontSize: 11, lineHeight: 16 },
});
