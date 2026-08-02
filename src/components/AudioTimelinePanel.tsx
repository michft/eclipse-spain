import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import {
  formatOffset,
  parseOffset,
  type AudioMarker,
  type ContactRecord,
} from "../domain/audioTimeline";
import {
  calculateSolarObscuration,
  CONTACT_IDS,
} from "../domain/eclipse";
import type { GeoPoint } from "../domain/geo";
import { useAudioTimeline } from "../features/audio/useAudioTimeline";
import { theme } from "../styles/theme";
import { ActionButton } from "./ActionButton";

interface AudioTimelinePanelProps {
  contacts: ContactRecord;
  elevationMeters: number;
  location: GeoPoint;
}

const formatCountdown = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    days > 0 ? `${days}d` : null,
    days > 0 || hours > 0 ? `${hours}h` : null,
    `${minutes}m`,
    `${String(seconds).padStart(2, "0")}s`,
  ]
    .filter(Boolean)
    .join(" ");
};

export const AudioTimelinePanel = ({
  contacts,
  elevationMeters,
  location,
}: AudioTimelinePanelProps) => {
  const timeline = useAudioTimeline(contacts);
  const [display, setDisplay] = useState<"time" | "obscuration">("time");
  const secondTick = Math.floor(timeline.now / 1000);
  const obscuration = useMemo(
    () =>
      calculateSolarObscuration(
        location,
        new Date(secondTick * 1000),
        elevationMeters,
      ),
    [elevationMeters, location, secondTick],
  );
  const targetById = useMemo(
    () =>
      new Map(
        timeline.resolvedMarkers.map((marker) => [
          marker.id,
          marker.targetUtcMilliseconds,
        ]),
      ),
    [timeline.resolvedMarkers],
  );

  return (
    <View style={styles.panel}>
      <View style={styles.displayControls}>
        <ActionButton
          onPress={() => setDisplay("time")}
          secondary={display !== "time"}
        >
          Time to next marker
        </ActionButton>
        <ActionButton
          onPress={() => setDisplay("obscuration")}
          secondary={display !== "obscuration"}
        >
          % Sun obscured
        </ActionButton>
      </View>
      <View style={styles.liveDisplay}>
        {display === "time" ? (
          <>
            <Text style={styles.liveValue}>
              {timeline.nextMarker
                ? formatCountdown(
                    timeline.nextMarker.targetUtcMilliseconds - timeline.now,
                  )
                : "No future marker"}
            </Text>
            <Text style={styles.liveLabel}>
              {timeline.nextMarker?.label ?? "Add or enable a future marker"}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.liveValue}>{(obscuration * 100).toFixed(3)}%</Text>
            <Text style={styles.liveLabel}>Sun obscured at current device time</Text>
          </>
        )}
      </View>

      <View style={styles.controls}>
        <ActionButton onPress={() => void timeline.test(true)} secondary>
          Test speech
        </ActionButton>
        <ActionButton onPress={() => void timeline.test(false)} secondary>
          Test tone
        </ActionButton>
        {timeline.armed ? (
          <ActionButton onPress={timeline.disarm}>Disarm</ActionButton>
        ) : (
          <ActionButton onPress={() => void timeline.arm()}>Arm timeline</ActionButton>
        )}
        <ActionButton onPress={timeline.addMarker} secondary>
          Add marker
        </ActionButton>
        <ActionButton onPress={timeline.restoreDefaults} secondary>
          Restore defaults
        </ActionButton>
      </View>
      <Text style={timeline.armed ? styles.armed : styles.message}>
        {timeline.armed ? "● ARMED · " : ""}
        {timeline.message}
      </Text>
      {timeline.pageWasHidden ? (
        <Text style={styles.warning}>
          This page was hidden after arming. The browser may have suspended timers;
          check the timeline and arm again if needed.
        </Text>
      ) : null}
      {!timeline.speechAvailable ? (
        <Text style={styles.warning}>
          Speech synthesis is unavailable in this browser. Spoken markers will use
          the tone fallback.
        </Text>
      ) : null}
      {timeline.clockWarning ? (
        <Text style={styles.warning}>{timeline.clockWarning}</Text>
      ) : null}

      <View style={styles.markers}>
        {timeline.markers.map((marker) => (
          <MarkerEditor
            anchorAvailable={contacts[marker.anchor] !== null}
            key={marker.id}
            marker={marker}
            onRemove={() => timeline.removeMarker(marker.id)}
            onUpdate={(update) => timeline.updateMarker(marker.id, update)}
            targetUtcMilliseconds={targetById.get(marker.id) ?? null}
          />
        ))}
      </View>
      {timeline.markers.length === 0 ? (
        <Text style={styles.message}>No markers. Add one when ready.</Text>
      ) : null}
      <Text style={styles.note}>
        Positive offsets play before the anchor; a leading minus plays after it.
        Examples: 45 seconds, 1:30, or -0:30. Browser audio cannot be guaranteed
        while the page is hidden, suspended, locked, or closed.
      </Text>
    </View>
  );
};

interface MarkerEditorProps {
  marker: AudioMarker;
  anchorAvailable: boolean;
  targetUtcMilliseconds: number | null;
  onUpdate: (update: Partial<AudioMarker>) => void;
  onRemove: () => void;
}

const MarkerEditor = ({
  anchorAvailable,
  marker,
  onRemove,
  onUpdate,
  targetUtcMilliseconds,
}: MarkerEditorProps) => {
  const [offsetInput, setOffsetInput] = useState(formatOffset(marker.offsetSeconds));
  const [offsetError, setOffsetError] = useState(false);

  useEffect(() => {
    setOffsetInput(formatOffset(marker.offsetSeconds));
  }, [marker.offsetSeconds]);

  const applyOffset = (): void => {
    const parsed = parseOffset(offsetInput);
    if (parsed === null) {
      setOffsetError(true);
      return;
    }
    setOffsetError(false);
    setOffsetInput(formatOffset(parsed));
    onUpdate({ offsetSeconds: parsed });
  };

  return (
    <View style={[styles.marker, !marker.enabled && styles.markerDisabled]}>
      <TextInput
        accessibilityLabel="Audio marker label"
        onChangeText={(label) => onUpdate({ label })}
        style={styles.input}
        value={marker.label}
      />
      <View style={styles.anchorOptions}>
        {CONTACT_IDS.map((anchor) => (
          <ActionButton
            key={anchor}
            onPress={() => onUpdate({ anchor })}
            secondary={marker.anchor !== anchor}
            style={styles.anchorButton}
          >
            {anchor.toUpperCase()}
          </ActionButton>
        ))}
      </View>
      <View style={styles.offsetRow}>
        <View style={styles.offsetField}>
          <Text style={styles.fieldLabel}>Seconds or m:ss</Text>
          <TextInput
            accessibilityLabel="Marker offset"
            keyboardType="numbers-and-punctuation"
            onBlur={applyOffset}
            onChangeText={setOffsetInput}
            onSubmitEditing={applyOffset}
            style={[styles.input, offsetError && styles.inputError]}
            value={offsetInput}
          />
        </View>
        <View style={styles.markerStatus}>
          <Text style={styles.targetTime}>
            {targetUtcMilliseconds === null
              ? anchorAvailable
                ? "Disabled"
                : "Anchor unavailable here"
              : new Date(targetUtcMilliseconds).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
          </Text>
          {offsetError ? <Text style={styles.warning}>Use 45, 1:30, or -0:30.</Text> : null}
        </View>
      </View>
      <View style={styles.controls}>
        <ActionButton
          onPress={() => onUpdate({ enabled: !marker.enabled })}
          secondary
        >
          {marker.enabled ? "Enabled" : "Disabled"}
        </ActionButton>
        <ActionButton
          onPress={() => onUpdate({ spoken: !marker.spoken })}
          secondary
        >
          {marker.spoken ? "Spoken" : "Tone only"}
        </ActionButton>
        <ActionButton onPress={onRemove} secondary>
          Remove
        </ActionButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    gap: 16,
  },
  displayControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  liveDisplay: {
    alignItems: "center",
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    padding: 22,
  },
  liveValue: {
    color: theme.color.accent,
    fontSize: 34,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  liveLabel: {
    color: theme.color.muted,
    fontSize: 13,
    marginTop: 5,
    textAlign: "center",
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  message: {
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  armed: {
    color: theme.color.good,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  warning: {
    color: theme.color.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  markers: {
    gap: 12,
  },
  marker: {
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  markerDisabled: {
    opacity: 0.65,
  },
  input: {
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    color: theme.color.text,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  inputError: {
    borderColor: theme.color.danger,
  },
  anchorOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  anchorButton: {
    minHeight: 38,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  offsetRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  offsetField: {
    minWidth: 150,
  },
  fieldLabel: {
    color: theme.color.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  markerStatus: {
    flex: 1,
    minWidth: 160,
    paddingBottom: 8,
  },
  targetTime: {
    color: theme.color.text,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  note: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
