import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton } from "./src/components/ActionButton";
import { AudioTimelinePanel } from "./src/components/AudioTimelinePanel";
import { Card } from "./src/components/Card";
import { HorizonSimulator } from "./src/components/HorizonSimulator";
import { LocationFinderPanel } from "./src/components/LocationFinderPanel";
import { MapPanel } from "./src/components/MapPanel";
import {
  ECLIPSE_EVENTS,
  getEclipseEvent,
  type EclipseEventDefinition,
  type EclipseEventId,
} from "./src/data/eclipseEvents";
import {
  CONTACT_IDS,
  type EclipseContact,
} from "./src/domain/eclipse";
import { isValidGeoPoint, type GeoPoint } from "./src/domain/geo";
import {
  type RemoteData,
  useLocationAnalysis,
} from "./src/features/analysis/useLocationAnalysis";
import { useLocationFinder } from "./src/features/analysis/useLocationFinder";
import { getCurrentLocation } from "./src/services/geolocation";
import {
  OPEN_METEO_ELEVATION_SOURCE_URL,
  OPEN_METEO_FORECAST_SOURCE_URL,
  type CloudForecast,
  type ElevationProfileResult,
} from "./src/services/openMeteo";
import { OPENSTREETMAP_SOURCE_URL } from "./src/services/overpass";
import {
  copyText,
  makeQrCode,
  readSharedSelection,
  updateShareUrl,
} from "./src/services/share";
import { theme } from "./src/styles/theme";

const defaultLocation = (event: EclipseEventDefinition): GeoPoint =>
  event.centerLine[Math.floor(event.centerLine.length / 2)] ?? event.mapCenter;

const formatUtc = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso)) + " UTC";

const formatLocal = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));

const formatDuration = (seconds: number | null): string => {
  if (seconds === null) {
    return "No totality";
  }
  const wholeSeconds = Math.round(seconds);
  return `${Math.floor(wholeSeconds / 60)}m ${String(wholeSeconds % 60).padStart(2, "0")}s`;
};

const RemoteMessage = <T,>({
  data,
  idle,
}: {
  data: RemoteData<T>;
  idle: string;
}) => {
  if (data.state === "loading") {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={theme.color.accent} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }
  if (data.state === "idle") {
    return <Text style={styles.muted}>{idle}</Text>;
  }
  if (data.result.status !== "success") {
    return <Text style={styles.warning}>{data.result.reason}</Text>;
  }
  return null;
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const ContactRow = ({ contact }: { contact: EclipseContact | null }) => {
  if (!contact) {
    return null;
  }
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactName}>
        <Text style={styles.rowTitle}>{contact.id.toUpperCase()}</Text>
        <Text style={styles.smallMuted}>{contact.label}</Text>
      </View>
      <View style={styles.contactTimes}>
        <Text style={styles.rowValue}>{formatUtc(contact.utc)}</Text>
        <Text style={styles.smallMuted}>{formatLocal(contact.utc)}</Text>
        <Text style={styles.smallMuted}>
          Sun {contact.sunAltitudeDegrees.toFixed(1)}° alt ·{" "}
          {contact.sunAzimuthDegrees.toFixed(0)}° az
        </Text>
      </View>
    </View>
  );
};

/**
 * Renders the eclipse event and location planning screen.
 *
 * Provides event selection, coordinate and device-location input, map-based location
 * selection, eclipse analysis, terrain and weather information, location finding,
 * audio planning, source links, and sharing controls. Interactive controls and
 * links include accessible labels and roles.
 */
export default function App() {
  const [initialSelection] = useState(() => readSharedSelection());
  const [eventId, setEventId] = useState<EclipseEventId>(
    initialSelection?.eventId ?? "spain-2026",
  );
  const selectedEvent = getEclipseEvent(eventId);
  const [location, setLocation] = useState<GeoPoint>(
    initialSelection?.location ?? defaultLocation(selectedEvent),
  );
  const [latitudeInput, setLatitudeInput] = useState(String(location.latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(location.longitude));
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState("Copy link");
  const { analysis, analyze } = useLocationAnalysis(
    selectedEvent,
    location,
  );
  const { finder, find: findLocations, reset: resetFinder } = useLocationFinder();

  useEffect(() => {
    void analyze(selectedEvent, location);
  }, [analyze, location, selectedEvent]);

  useEffect(() => {
    let active = true;
    const nextShareUrl = updateShareUrl(selectedEvent.id, location);
    setShareUrl(nextShareUrl);
    setQrCode(null);
    setQrError(null);
    if (nextShareUrl) {
      void makeQrCode(nextShareUrl).then((result) => {
        if (active) {
          if (result.status === "success") {
            setQrCode(result.value);
          } else {
            setQrError(result.reason);
          }
        }
      });
    }
    return () => {
      active = false;
    };
  }, [location, selectedEvent.id]);

  const selectLocation = (
    nextLocation: GeoPoint,
    preserveCandidates = false,
  ): void => {
    if (!preserveCandidates) {
      resetFinder();
    }
    setLocationError(null);
    setLocation(nextLocation);
    setLatitudeInput(nextLocation.latitude.toFixed(5));
    setLongitudeInput(nextLocation.longitude.toFixed(5));
  };

  const selectEvent = (nextEventId: EclipseEventId): void => {
    const nextEvent = getEclipseEvent(nextEventId);
    setEventId(nextEventId);
    selectLocation(defaultLocation(nextEvent));
  };

  const useCoordinates = (): void => {
    if (!latitudeInput.trim() || !longitudeInput.trim()) {
      setLocationError("Enter latitude −90 to 90 and longitude −180 to 180.");
      return;
    }
    const nextLocation = {
      latitude: Number(latitudeInput.trim()),
      longitude: Number(longitudeInput.trim()),
    };
    if (!isValidGeoPoint(nextLocation)) {
      setLocationError("Enter latitude −90 to 90 and longitude −180 to 180.");
      return;
    }
    if (
      nextLocation.latitude === location.latitude &&
      nextLocation.longitude === location.longitude
    ) {
      void analyze(selectedEvent, location);
      return;
    }
    selectLocation(nextLocation);
  };

  const useDeviceLocation = async (): Promise<void> => {
    setGettingLocation(true);
    const result = await getCurrentLocation();
    setGettingLocation(false);
    if (result.status === "success") {
      selectLocation(result.value);
    } else {
      setLocationError(result.reason);
    }
  };

  const eclipse =
    analysis.eclipse.status === "success" ? analysis.eclipse.value : null;
  const elevation =
    analysis.elevation.state === "result" &&
    analysis.elevation.result.status === "success"
      ? analysis.elevation.result.value
      : null;
  const cloud =
    analysis.cloud.state === "result" &&
    analysis.cloud.result.status === "success"
      ? analysis.cloud.result.value
      : null;

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
            Choose a search area, compare observing candidates, and simulate the
            eclipse over their terrain horizon.
          </Text>
        </View>

        <Card eyebrow="01" title="Find a location">
          <Text style={styles.fieldLabel}>Eclipse</Text>
          <View style={styles.eventOptions}>
            {ECLIPSE_EVENTS.map((event) => (
              <ActionButton
                key={event.id}
                onPress={() => selectEvent(event.id)}
                secondary={event.id !== selectedEvent.id}
                style={styles.eventButton}
              >
                {event.region} · {event.eventDateUtc.slice(0, 4)}
              </ActionButton>
            ))}
          </View>
          <Text style={styles.eventName}>{selectedEvent.name}</Text>

          <View style={styles.coordinateFields}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput
                accessibilityLabel="Latitude"
                keyboardType="numbers-and-punctuation"
                onChangeText={setLatitudeInput}
                style={styles.input}
                value={latitudeInput}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput
                accessibilityLabel="Longitude"
                keyboardType="numbers-and-punctuation"
                onChangeText={setLongitudeInput}
                style={styles.input}
                value={longitudeInput}
              />
            </View>
          </View>
          {locationError ? <Text style={styles.warning}>{locationError}</Text> : null}
          <View style={styles.actions}>
            <ActionButton onPress={useCoordinates}>Analyse coordinates</ActionButton>
            <ActionButton
              disabled={gettingLocation}
              onPress={() => void useDeviceLocation()}
              secondary
            >
              {gettingLocation ? "Finding location…" : "Use my location"}
            </ActionButton>
          </View>
          <View style={styles.mapFrame}>
            <MapPanel
              bounds={selectedEvent.mapBounds}
              candidates={
                finder.state === "result" && finder.result.status === "success"
                  ? finder.result.value.candidates.map(
                      (candidate) => candidate.location,
                    )
                  : []
              }
              centerLine={selectedEvent.centerLine}
              location={location}
              onLocationChange={(nextLocation) => selectLocation(nextLocation)}
            />
          </View>
          <Text style={styles.smallMuted}>
            Tap the map to set the rough search centre. Blue: selected point.
            Purple: top candidate. Green: other candidates. Gold line:
            NASA-derived centre line.
          </Text>
          <LocationFinderPanel
            finder={finder}
            onFind={() => void findLocations(selectedEvent, location)}
            onSelect={(candidate) => selectLocation(candidate.location, true)}
          />
        </Card>

        <Card eyebrow="02" title="Eclipse at this point">
          {analysis.eclipse.status === "error" ||
          analysis.eclipse.status === "unavailable" ? (
            <Text style={styles.warning}>{analysis.eclipse.reason}</Text>
          ) : eclipse ? (
            <>
              <View style={styles.metrics}>
                <Metric label="Local eclipse" value={eclipse.kind.toUpperCase()} />
                <Metric
                  label="Sun obscured"
                  value={`${(eclipse.obscuration * 100).toFixed(2)}%`}
                />
                <Metric label="Magnitude" value={eclipse.magnitude.toFixed(4)} />
                <Metric
                  label="Centre-line distance"
                  value={
                    eclipse.centerLineDistanceKm === null
                      ? "—"
                      : `${eclipse.centerLineDistanceKm.toFixed(1)} km`
                  }
                />
                <Metric
                  label="Totality duration"
                  value={formatDuration(eclipse.totalityDurationSeconds)}
                />
              </View>
              <View style={styles.rows}>
                {CONTACT_IDS.map((contactId) => (
                  <ContactRow
                    contact={eclipse.contacts[contactId]}
                    key={contactId}
                  />
                ))}
              </View>
              <Text style={styles.footnote}>
                UTC/solar calculations: Astronomy Engine. Centre line: simplified
                regional polyline derived from the linked NASA path table.
              </Text>
            </>
          ) : null}
        </Card>

        <Card eyebrow="03" title="Live observer sky and terrain horizon">
          <RemoteMessage
            data={analysis.elevation}
            idle="Choose a valid eclipse location to load elevation."
          />
          {elevation && eclipse ? (
            <>
              <View style={styles.metrics}>
                <Metric
                  label="Observer elevation"
                  value={`${Math.round(elevation.observerElevationMeters)} m`}
                />
                <Metric
                  label="Terrain field of view"
                  value={`${elevation.skyline.fieldOfViewDegrees.toFixed(0)}°`}
                />
                <Metric
                  label="Azimuth samples"
                  value={String(elevation.skyline.samples.length)}
                />
              </View>
              <HorizonSimulator
                contacts={eclipse.contacts}
                elevation={elevation}
                location={location}
              />
              <Text style={styles.footnote}>
                Terrain skyline is centred on the Sun at maximum and sampled out
                to 20 km. Elevation retrieved {formatUtc(
                  elevation.retrievedUtc,
                )}. This is a terrain simulation, not a visibility guarantee.
              </Text>
            </>
          ) : null}
        </Card>

        <Card eyebrow="04" title="Cloud forecast">
          <RemoteMessage
            data={analysis.cloud}
            idle="Cloud data loads after location analysis."
          />
          {cloud ? <CloudDetails cloud={cloud} /> : null}
        </Card>

        <Card eyebrow="05" title="Audio timeline">
          {eclipse ? (
            <AudioTimelinePanel
              contacts={eclipse.contacts}
              elevationMeters={elevation?.observerElevationMeters ?? 0}
              location={location}
            />
          ) : (
            <Text style={styles.muted}>
              Select a location with eclipse contacts to configure audio.
            </Text>
          )}
        </Card>

        <Card eyebrow="06" title="Sources and sharing">
          <View style={styles.sourceList}>
            {selectedEvent.sources.map((source) => (
              <Text
                accessibilityRole="link"
                key={source.url}
                onPress={() => void Linking.openURL(source.url)}
                style={styles.link}
              >
                {source.label} ↗
              </Text>
            ))}
            <Text
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(OPEN_METEO_ELEVATION_SOURCE_URL)
              }
              style={styles.link}
            >
              Open-Meteo elevation and Copernicus DEM ↗
            </Text>
            <Text
              accessibilityRole="link"
              onPress={() => void Linking.openURL(OPEN_METEO_FORECAST_SOURCE_URL)}
              style={styles.link}
            >
              Open-Meteo weather forecast ↗
            </Text>
            <Text
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(OPENSTREETMAP_SOURCE_URL)
              }
              style={styles.link}
            >
              OpenStreetMap data and attribution ↗
            </Text>
          </View>
          <View style={styles.shareBlock}>
            {qrCode ? (
              <Image
                accessibilityLabel="QR code for this eclipse location"
                source={{ uri: qrCode }}
                style={styles.qrCode}
              />
            ) : qrError ? (
              <Text style={styles.warning}>{qrError}</Text>
            ) : (
              <ActivityIndicator color={theme.color.accent} />
            )}
            <View style={styles.shareText}>
              <Text style={styles.rowTitle}>Share this exact event and point</Text>
              <Text numberOfLines={3} selectable style={styles.shareUrl}>
                {shareUrl}
              </Text>
              <ActionButton
                onPress={() => {
                  void copyText(shareUrl).then((copied) => {
                    setCopyState(copied ? "Copied" : "Copy unavailable");
                  });
                }}
                secondary
              >
                {copyState}
              </ActionButton>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const CloudDetails = ({ cloud }: { cloud: CloudForecast }) => (
  <>
    <View style={styles.metrics}>
      <Metric label="Total" value={`${cloud.totalPercent}%`} />
      <Metric label="Low" value={`${cloud.lowPercent}%`} />
      <Metric label="Middle" value={`${cloud.middlePercent}%`} />
      <Metric label="High" value={`${cloud.highPercent}%`} />
    </View>
    <Text style={styles.smallMuted}>Valid {formatUtc(cloud.validUtc)}</Text>
    <Text style={styles.footnote}>
      Forecast retrieved {formatUtc(cloud.retrievedUtc)}. Model forecasts change;
      recheck near the event.
    </Text>
  </>
);

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.color.background,
    flex: 1,
  },
  page: {
    alignSelf: "center",
    gap: theme.space.large,
    maxWidth: 1180,
    paddingHorizontal: theme.space.medium,
    paddingVertical: theme.space.xlarge,
    width: "100%",
  },
  hero: {
    gap: theme.space.small,
    maxWidth: 760,
  },
  kicker: {
    color: theme.color.accent,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heading: {
    color: theme.color.text,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  lede: {
    color: theme.color.muted,
    fontSize: 18,
    lineHeight: 27,
  },
  eventOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.small,
  },
  eventButton: {
    flexGrow: 1,
  },
  eventName: {
    color: theme.color.text,
    fontSize: 17,
    fontWeight: "700",
  },
  coordinateFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.medium,
  },
  field: {
    flex: 1,
    minWidth: 180,
  },
  fieldLabel: {
    color: theme.color.muted,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: theme.space.xsmall,
  },
  input: {
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    color: theme.color.text,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.small,
  },
  mapFrame: {
    borderColor: theme.color.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    overflow: "hidden",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.small,
  },
  metric: {
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.small,
    flexGrow: 1,
    minWidth: 135,
    padding: 12,
  },
  metricValue: {
    color: theme.color.text,
    fontSize: 20,
    fontWeight: "800",
  },
  metricLabel: {
    color: theme.color.muted,
    fontSize: 12,
    marginTop: 3,
  },
  rows: {
    gap: 0,
  },
  contactRow: {
    alignItems: "flex-start",
    borderBottomColor: theme.color.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: theme.space.medium,
    paddingVertical: 12,
  },
  contactName: {
    minWidth: 120,
  },
  contactTimes: {
    alignItems: "flex-end",
    flex: 1,
  },
  rowTitle: {
    color: theme.color.text,
    fontSize: 14,
    fontWeight: "800",
  },
  rowValue: {
    color: theme.color.text,
    fontSize: 15,
    fontWeight: "700",
  },
  smallMuted: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  muted: {
    color: theme.color.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  warning: {
    color: theme.color.warning,
    fontSize: 14,
    lineHeight: 21,
  },
  footnote: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space.small,
  },
  sourceList: {
    alignItems: "flex-start",
    gap: 10,
  },
  link: {
    color: theme.color.sky,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: "underline",
  },
  shareBlock: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.large,
  },
  qrCode: {
    borderRadius: theme.radius.small,
    height: 176,
    width: 176,
  },
  shareText: {
    flex: 1,
    gap: theme.space.small,
    minWidth: 220,
  },
  shareUrl: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 17,
  },
});
