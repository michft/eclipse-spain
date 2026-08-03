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
 * Renders the eclipse event and location planning screen with immersive map explorer.
 *
 * Full-screen map canvas with floating location info overlay and swipeable horizon
 * panel. Mobile-first design with interactive map, horizon simulator, and quick access
 * to eclipse analysis, weather, audio timeline, and sharing.
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
  const [panelOpen, setPanelOpen] = useState(false);
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

      {/* Header Bar - Always Visible */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Eclipse Observer</Text>
          <Text style={styles.headerSubtitle}>
            {selectedEvent.region} · {selectedEvent.eventDateUtc.slice(0, 4)}
          </Text>
        </View>
        <View style={styles.headerControls}>
          <View style={styles.eventSelector}>
            {ECLIPSE_EVENTS.map((event) => (
              <ActionButton
                key={event.id}
                onPress={() => selectEvent(event.id)}
                secondary={event.id !== selectedEvent.id}
                style={styles.miniEventButton}
              >
                {event.region}
              </ActionButton>
            ))}
          </View>
        </View>
      </View>

      {/* Conditional View: Map or Horizon Panel */}
      <View style={styles.contentArea}>
        {!panelOpen && (
          <>
            {/* Map View */}
            <View style={styles.mapContainer}>
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

              {/* Floating Info Card */}
              <View style={styles.floatingCard}>
                <View style={styles.floatingHeader}>
                  <Text style={styles.floatingTitle}>Current Point</Text>
                  <Text style={styles.floatingLocation}>
                    {location.latitude.toFixed(3)}°N,{" "}
                    {Math.abs(location.longitude).toFixed(3)}°E
                  </Text>
                </View>

                {eclipse ? (
                  <View style={styles.floatingMetrics}>
                    <View style={styles.floatingMetric}>
                      <Text style={styles.floatingMetricValue}>
                        {(eclipse.obscuration * 100).toFixed(0)}%
                      </Text>
                      <Text style={styles.floatingMetricLabel}>Obscured</Text>
                    </View>
                    <View style={styles.floatingMetric}>
                      <Text style={styles.floatingMetricValue}>
                        {eclipse.centerLineDistanceKm === null
                          ? "—"
                          : `${eclipse.centerLineDistanceKm.toFixed(0)} km`}
                      </Text>
                      <Text style={styles.floatingMetricLabel}>to Path</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.floatingActions}>
                  <ActionButton onPress={() => setPanelOpen(true)} secondary>
                    Horizon
                  </ActionButton>
                  <ActionButton
                    onPress={() => void findLocations(selectedEvent, location)}
                    secondary
                  >
                    Find
                  </ActionButton>
                </View>
              </View>
            </View>

            {/* Coordinate Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                accessibilityLabel="Latitude"
                keyboardType="numbers-and-punctuation"
                onChangeText={setLatitudeInput}
                placeholder="Lat"
                placeholderTextColor={theme.color.muted}
                style={styles.miniInput}
                value={latitudeInput}
              />
              <TextInput
                accessibilityLabel="Longitude"
                keyboardType="numbers-and-punctuation"
                onChangeText={setLongitudeInput}
                placeholder="Lon"
                placeholderTextColor={theme.color.muted}
                style={styles.miniInput}
                value={longitudeInput}
              />
              <ActionButton onPress={useCoordinates} style={styles.goButton}>
                Go
              </ActionButton>
              <ActionButton
                disabled={gettingLocation}
                onPress={() => void useDeviceLocation()}
                secondary
                style={styles.locationButton}
              >
                📍
              </ActionButton>
            </View>
          </>
        )}

        {panelOpen && (
          /* Horizon View */
          <ScrollView style={styles.horizonView} showsVerticalScrollIndicator={false}>
            <View style={styles.horizonContainer}>
              <View style={styles.horizonHeader}>
                <Text style={styles.horizonTitle}>Sky at Maximum Eclipse</Text>
                <ActionButton onPress={() => setPanelOpen(false)} secondary>
                  ← Back to Map
                </ActionButton>
              </View>

            {/* Horizon Simulator */}
            {elevation && eclipse ? (
              <>
                <View style={styles.horizonFrame}>
                  <HorizonSimulator
                    contacts={eclipse.contacts}
                    elevation={elevation}
                    location={location}
                  />
                </View>

                <View style={styles.panelMetrics}>
                  <Metric
                    label="Observer elevation"
                    value={`${Math.round(elevation.observerElevationMeters)} m`}
                  />
                  <Metric
                    label="Terrain FOV"
                    value={`${elevation.skyline.fieldOfViewDegrees.toFixed(0)}°`}
                  />
                </View>

                {/* Contact Times */}
                <View style={styles.contactsSection}>
                  <Text style={styles.sectionTitle}>Contact Times</Text>
                  {CONTACT_IDS.map((contactId) => (
                    <ContactRow
                      contact={eclipse.contacts[contactId]}
                      key={contactId}
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.muted}>Select a location to load elevation data.</Text>
            )}

            {/* Weather Section */}
            {cloud ? (
              <View style={styles.tabsSection}>
                <Text style={styles.sectionTitle}>Weather</Text>
                <CloudDetails cloud={cloud} />
              </View>
            ) : null}

            {/* Sources */}
            <View style={styles.sourceList}>
              <Text style={styles.sectionTitle}>Sources</Text>
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
                Open-Meteo ↗
              </Text>
            </View>

            {/* Share Section */}
            <View style={styles.shareSection}>
              <Text style={styles.sectionTitle}>Share</Text>
              <View style={styles.shareBlock}>
                {qrCode ? (
                  <Image
                    accessibilityLabel="QR code"
                    source={{ uri: qrCode }}
                    style={styles.qrCode}
                  />
                ) : qrError ? (
                  <Text style={styles.warning}>{qrError}</Text>
                ) : (
                  <ActivityIndicator color={theme.color.accent} />
                )}
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

            <View style={styles.panelBottom} />
          </View>
          </ScrollView>
        )}
      </View>
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
  contentArea: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.color.surfaceRaised,
    borderBottomColor: theme.color.border,
    borderBottomWidth: 1,
    paddingHorizontal: theme.space.medium,
    paddingVertical: theme.space.small,
  },
  headerContent: {
    marginBottom: theme.space.small,
  },
  headerTitle: {
    color: theme.color.text,
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: theme.color.muted,
    fontSize: 13,
    marginTop: 2,
  },
  headerControls: {
    gap: theme.space.small,
  },
  eventSelector: {
    flexDirection: "row",
    gap: theme.space.xsmall,
  },
  miniEventButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  floatingCard: {
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.medium,
    bottom: 80,
    left: theme.space.medium,
    paddingHorizontal: theme.space.small,
    paddingVertical: theme.space.small,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 180,
  },
  floatingHeader: {
    marginBottom: theme.space.xsmall,
  },
  floatingTitle: {
    color: theme.color.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  floatingLocation: {
    color: theme.color.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  floatingMetrics: {
    flexDirection: "row",
    gap: theme.space.xsmall,
    marginBottom: theme.space.small,
  },
  floatingMetric: {
    flex: 1,
  },
  floatingMetricValue: {
    color: theme.color.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  floatingMetricLabel: {
    color: theme.color.muted,
    fontSize: 10,
    marginTop: 1,
  },
  floatingActions: {
    flexDirection: "row",
    gap: theme.space.xsmall,
  },
  inputBar: {
    backgroundColor: theme.color.surfaceRaised,
    borderTopColor: theme.color.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: theme.space.xsmall,
    paddingHorizontal: theme.space.small,
    paddingVertical: theme.space.xsmall,
  },
  miniInput: {
    backgroundColor: theme.color.background,
    borderColor: theme.color.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    color: theme.color.text,
    flex: 1,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  goButton: {
    paddingHorizontal: 12,
  },
  locationButton: {
    paddingHorizontal: 10,
  },
  horizonView: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  horizonContainer: {
    paddingHorizontal: theme.space.medium,
    paddingVertical: theme.space.medium,
  },
  horizonHeader: {
    marginBottom: theme.space.large,
    gap: theme.space.small,
  },
  horizonTitle: {
    color: theme.color.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: theme.space.small,
  },
  horizonFrame: {
    borderColor: theme.color.border,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    marginBottom: theme.space.large,
    overflow: "hidden",
    height: 200,
  },
  panelMetrics: {
    flexDirection: "row",
    gap: theme.space.small,
    marginBottom: theme.space.large,
  },
  sectionTitle: {
    color: theme.color.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: theme.space.small,
    marginTop: theme.space.medium,
  },
  contactsSection: {
    marginBottom: theme.space.large,
    borderTopColor: theme.color.border,
    borderTopWidth: 1,
    paddingTop: theme.space.medium,
  },
  tabsSection: {
    marginBottom: theme.space.large,
  },
  sourceList: {
    alignItems: "flex-start",
    gap: theme.space.xsmall,
    marginBottom: theme.space.large,
    paddingVertical: theme.space.medium,
    borderTopColor: theme.color.border,
    borderTopWidth: 1,
  },
  link: {
    color: theme.color.sky,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: "underline",
  },
  shareSection: {
    marginBottom: theme.space.xlarge,
    paddingVertical: theme.space.medium,
    borderTopColor: theme.color.border,
    borderTopWidth: 1,
  },
  shareBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.space.medium,
  },
  qrCode: {
    borderRadius: theme.radius.small,
    height: 100,
    width: 100,
  },
  panelBottom: {
    height: theme.space.xlarge,
  },
  
  // Reused components
  metric: {
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.small,
    flexGrow: 1,
    minWidth: 100,
    padding: 12,
  },
  metricValue: {
    color: theme.color.text,
    fontSize: 18,
    fontWeight: "800",
  },
  metricLabel: {
    color: theme.color.muted,
    fontSize: 11,
    marginTop: 3,
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
});
