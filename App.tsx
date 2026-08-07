import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

import { ActionButton } from "./src/components/ActionButton";
import { AudioTimelinePanel } from "./src/components/AudioTimelinePanel";
import { HorizonSimulator } from "./src/components/HorizonSimulator";
import { LocationFinderPanel } from "./src/components/LocationFinderPanel";
import { MapPanel } from "./src/components/MapPanel";
import type { MapCamera } from "./src/components/mapViewState";
import {
  ECLIPSE_EVENTS,
  getEclipseEvent,
  type EclipseEventDefinition,
  type EclipseEventId,
} from "./src/data/eclipseEvents";
import type { MapRegionOption } from "./src/components/mapViewState";
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
import { MAP_HEIGHT } from "./src/styles/layout";
import { theme } from "./src/styles/theme";

const defaultLocation = (event: EclipseEventDefinition): GeoPoint =>
  event.mapCenter;

const ICELAND_2026_BOUNDS = {
  east: -12.5,
  north: 67,
  south: 60,
  west: -35,
} as const;

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

const APP_PAGES = [
  { id: "home", label: "Map" },
  { id: "horizon", label: "Horizon" },
  { id: "contacts", label: "Contact times" },
  { id: "weather", label: "Weather" },
  { id: "sources", label: "Sources" },
  { id: "qr", label: "QR" },
] as const;
type AppPage = (typeof APP_PAGES)[number]["id"];

const PageView = ({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) => (
  <ScrollView
    alwaysBounceVertical
    contentContainerStyle={[styles.pageContent, styles.scrollContent]}
    keyboardShouldPersistTaps="handled"
    nestedScrollEnabled
    showsVerticalScrollIndicator={false}
    style={styles.pageView}
  >
    <Text accessibilityRole="header" style={styles.pageTitle}>
      {title}
    </Text>
    <Text style={styles.pageDescription}>{description}</Text>
    {children}
  </ScrollView>
);

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
 * Renders the eclipse observation planning application.
 *
 * Provides event and location selection, map exploration, horizon simulation,
 * contact times, weather information, source links, and QR-code sharing.
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
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [mapKeyVisible, setMapKeyVisible] = useState(false);
  const [mapCamera, setMapCamera] = useState<MapCamera | null>(null);
  const [mapRegionId, setMapRegionId] = useState("spain");
  const [horizonTechnicalVisible, setHorizonTechnicalVisible] = useState(false);
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
    setEventMenuOpen(false);
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
  const totalitySummary =
    eclipse?.totalityDurationSeconds !== null &&
    eclipse?.totalityDurationSeconds !== undefined &&
    eclipse.contacts.maximum
      ? `Totality: ${formatDuration(eclipse.totalityDurationSeconds)} · maximum ${formatUtc(eclipse.contacts.maximum.utc)}`
      : "No totality at this location";
  const horizonTimeDescription = eclipse
    ? eclipse.contacts.c2 && eclipse.contacts.c3 && eclipse.contacts.maximum
      ? `Time guide: the chart runs from 30 minutes before C1 to 30 minutes after C4. Totality runs from ${formatUtc(eclipse.contacts.c2.utc)} to ${formatUtc(eclipse.contacts.c3.utc)} (${formatDuration(eclipse.totalityDurationSeconds)}); maximum is ${formatUtc(eclipse.contacts.maximum.utc)}.`
      : "Time guide: the chart runs from 30 minutes before C1 to 30 minutes after C4. No totality occurs at this location."
    : "";
  const mapRegionOptions: readonly MapRegionOption[] | undefined =
    selectedEvent.id === "spain-2026"
      ? [
          { bounds: selectedEvent.mapBounds, id: "spain", label: "Spain" },
          { bounds: ICELAND_2026_BOUNDS, id: "iceland", label: "Iceland" },
        ]
      : undefined;

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
            <ActionButton
              accessibilityState={{ expanded: eventMenuOpen }}
              onPress={() => setEventMenuOpen((open) => !open)}
              secondary
              style={styles.miniEventButton}
            >
              Event · {selectedEvent.region} ▾
            </ActionButton>
            {eventMenuOpen ? (
              <View accessibilityLabel="Eclipse event menu" style={styles.eventOptions}>
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
            ) : null}
          </View>
          <ScrollView
            contentContainerStyle={styles.pageNavigation}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {APP_PAGES.map((page) => (
              <ActionButton
                key={page.id}
                onPress={() => setActivePage(page.id)}
                secondary={activePage !== page.id}
                style={styles.pageButton}
              >
                {page.label}
              </ActionButton>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* One selected page; event and location state remain shared. */}
      <View style={styles.contentArea}>
        {activePage === "home" ? (
          <ScrollView
            alwaysBounceVertical
            contentContainerStyle={styles.mapPageContent}
            key="map-view"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.mapPage}
          >
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
                contours={selectedEvent.contours}
                initialCamera={mapCamera}
                location={location}
                onLocationChange={(nextLocation) => selectLocation(nextLocation)}
                onCameraChange={setMapCamera}
                path={selectedEvent.path}
                onRegionChange={setMapRegionId}
                regionOptions={mapRegionOptions}
                selectedRegionId={mapRegionOptions ? mapRegionId : undefined}
                totalitySummary={totalitySummary}
              />

              <View style={styles.mapKeyToggle}>
                <ActionButton
                  accessibilityState={{ expanded: mapKeyVisible }}
                  onPress={() => setMapKeyVisible((visible) => !visible)}
                  secondary
                  style={styles.overlayToggle}
                >
                  Map key · {mapKeyVisible ? "Hide" : "Show"}
                </ActionButton>
              </View>
              {mapKeyVisible ? (
                <View pointerEvents="none" style={styles.mapLegend}>
                  <Text style={styles.mapLegendTitle}>Eclipse map</Text>
                  <Text style={styles.mapLegendText}>Amber area · 100% totality</Text>
                  <Text style={styles.mapLegendText}>Gold line · centre line</Text>
                  <Text style={styles.mapLegendText}>White lines · totality limits</Text>
                  <Text style={styles.mapLegendText}>Blue lines · partial obscuration</Text>
                  <Text style={styles.mapLegendText}>Green lines · maximum time UTC</Text>
                </View>
              ) : null}

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
                  <ActionButton onPress={() => setActivePage("horizon")} secondary>
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
            <LocationFinderPanel
              finder={finder}
              onFind={() => void findLocations(selectedEvent, location)}
              onSelect={(candidate) => selectLocation(candidate.location)}
            />
          </ScrollView>
        ) : null}

        {activePage === "horizon" ? (
          <PageView
            description="Animated Sun and Moon positions against the sampled terrain skyline."
            title="Horizon"
          >
            <RemoteMessage
              data={analysis.elevation}
              idle="Select a location to load elevation data."
            />
            {elevation && eclipse ? (
              <>
                <Text style={styles.horizonTimeDescription}>
                  {horizonTimeDescription}
                </Text>
                <View style={styles.simulatorSection}>
                  <Text style={styles.subSectionLabel}>Observer Sky View</Text>
                  <View style={styles.horizonFrame}>
                    <HorizonSimulator
                      contacts={eclipse.contacts}
                      elevation={elevation}
                      kind={eclipse.kind}
                      location={location}
                      showTechnicalDetails={horizonTechnicalVisible}
                    />
                  </View>
                </View>

                {/* Location & Elevation Metrics */}
                <ActionButton
                  accessibilityState={{ expanded: horizonTechnicalVisible }}
                  onPress={() =>
                    setHorizonTechnicalVisible((visible) => !visible)
                  }
                  secondary
                  style={styles.detailsToggle}
                >
                  Technical details · {horizonTechnicalVisible ? "Hide" : "Show"}
                </ActionButton>
                {horizonTechnicalVisible ? (
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}>
                      <Text style={styles.horizonMetricLabel}>Observer elevation</Text>
                      <Text style={styles.metricValueLarge}>
                        {Math.round(elevation.observerElevationMeters)} m
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.horizonMetricLabel}>Terrain FOV</Text>
                      <Text style={styles.metricValueLarge}>
                        {elevation.skyline.fieldOfViewDegrees.toFixed(0)}°
                      </Text>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </PageView>
        ) : null}

        <View
          style={[
            styles.pageHost,
            activePage !== "contacts" && styles.hiddenPage,
          ]}
        >
          <PageView
            description="UTC and local contact times for the selected observing point."
            title="Contact times"
          >
            {eclipse ? (
              <>
                <View style={styles.metrics}>
                  <Metric label="Local eclipse" value={eclipse.kind.toUpperCase()} />
                  <Metric
                    label="Sun obscured"
                    value={`${(eclipse.obscuration * 100).toFixed(2)}%`}
                  />
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
                <View style={styles.contactsSection}>
                  {CONTACT_IDS.map((contactId) => (
                    <ContactRow
                      contact={eclipse.contacts[contactId]}
                      key={contactId}
                    />
                  ))}
                </View>
                <Text style={styles.sectionTitle}>Audio timeline</Text>
                <AudioTimelinePanel
                  contacts={eclipse.contacts}
                  elevationMeters={elevation?.observerElevationMeters ?? 0}
                  location={location}
                />
              </>
            ) : analysis.eclipse.status === "success" ? null : (
              <Text style={styles.warning}>{analysis.eclipse.reason}</Text>
            )}
          </PageView>
        </View>

        {activePage === "weather" ? (
          <PageView
            description="Cloud forecast nearest eclipse maximum for this location."
            title="Weather"
          >
            <RemoteMessage
              data={analysis.cloud}
              idle="Select a location to load its cloud forecast."
            />
            {cloud ? (
              <CloudDetails cloud={cloud} />
            ) : null}
          </PageView>
        ) : null}

        {activePage === "sources" ? (
          <PageView
            description="Original and derived sources used for comparison."
            title="Sources"
          >
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
                Open-Meteo elevation ↗
              </Text>
              <Text
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(OPEN_METEO_FORECAST_SOURCE_URL)
                }
                style={styles.link}
              >
                Open-Meteo forecast ↗
              </Text>
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL(OPENSTREETMAP_SOURCE_URL)}
                style={styles.link}
              >
                OpenStreetMap attribution ↗
              </Text>
            </View>
          </PageView>
        ) : null}

        {activePage === "qr" ? (
          <PageView
            description="Share this event and observing point with another device."
            title="QR"
          >
            <View style={styles.shareSection}>
              <View style={styles.shareBlock}>
                {qrCode ? (
                  <View
                    accessibilityLabel="QR code"
                    accessibilityRole="image"
                    style={styles.qrCode}
                  >
                    <SvgXml height="100%" width="100%" xml={qrCode} />
                  </View>
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
              <Text selectable style={styles.shareUrl}>
                {shareUrl}
              </Text>
            </View>
          </PageView>
        ) : null}
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
  mapPage: {
    backgroundColor: theme.color.background,
    flex: 1,
  },
  mapPageContent: {
    flexGrow: 1,
    paddingBottom: theme.space.medium,
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
    gap: theme.space.xsmall,
  },
  eventOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xsmall,
  },
  miniEventButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageNavigation: {
    gap: theme.space.xsmall,
    paddingRight: theme.space.medium,
  },
  pageButton: {
    minWidth: 86,
    paddingHorizontal: 12,
  },
  pageView: {
    backgroundColor: theme.color.background,
    flex: 1,
  },
  pageHost: {
    flex: 1,
  },
  hiddenPage: {
    display: "none",
  },
  pageContent: {
    padding: theme.space.medium,
    paddingBottom: theme.space.xlarge,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageTitle: {
    color: theme.color.text,
    fontSize: 24,
    fontWeight: "800",
  },
  pageDescription: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.space.large,
    marginTop: theme.space.xsmall,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    position: "relative",
  },
  floatingCard: {
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.medium,
    bottom: theme.space.medium,
    left: theme.space.medium,
    paddingHorizontal: theme.space.small,
    paddingVertical: theme.space.small,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    width: 180,
    zIndex: 1100,
  },
  mapLegend: {
    backgroundColor: "rgba(8, 16, 24, 0.88)",
    borderColor: theme.color.border,
    borderRadius: theme.radius.small,
    borderWidth: 1,
    padding: theme.space.small,
    position: "absolute",
    right: theme.space.small,
    top: 60,
    zIndex: 1100,
  },
  mapKeyToggle: {
    position: "absolute",
    right: theme.space.small,
    top: theme.space.small,
    zIndex: 1100,
  },
  overlayToggle: {
    minHeight: 36,
    paddingHorizontal: theme.space.small,
    paddingVertical: theme.space.xsmall,
  },
  mapLegendTitle: {
    color: theme.color.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: theme.space.xsmall,
  },
  mapLegendText: {
    color: theme.color.text,
    fontSize: 10,
    lineHeight: 15,
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
  simulatorSection: {
    marginBottom: theme.space.large,
  },
  detailsToggle: {
    alignSelf: "flex-start",
    marginBottom: theme.space.medium,
  },
  subSectionLabel: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: theme.space.small,
  },
  horizonFrame: {
    borderColor: theme.color.border,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    marginBottom: theme.space.medium,
    marginHorizontal: -theme.space.medium,
    paddingVertical: theme.space.medium,
  },
  horizonTimeDescription: {
    color: theme.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.space.large,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: theme.space.medium,
    marginBottom: theme.space.large,
  },
  metricBox: {
    flex: 1,
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.small,
    padding: theme.space.small,
    borderColor: theme.color.border,
    borderWidth: 1,
  },
  horizonMetricLabel: {
    color: theme.color.muted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  metricValueLarge: {
    color: theme.color.accent,
    fontSize: 20,
    fontWeight: "800",
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
  shareUrl: {
    color: theme.color.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: theme.space.medium,
  },
  qrCode: {
    borderRadius: theme.radius.small,
    height: 100,
    width: 100,
  },
  
  // Reused components
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.small,
    marginBottom: theme.space.medium,
  },
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
