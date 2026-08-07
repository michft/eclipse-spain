import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  Callout,
  Marker,
  Polygon,
  Polyline,
  type MapPressEvent,
} from "react-native-maps";

import type { MapBounds } from "../data/eclipseEvents";
import type { EclipsePathGeometry } from "../data/eclipsePaths";
import type { GeoPoint } from "../domain/geo";
import type { MapCamera } from "./mapViewState";
import type { MapRegionOption } from "./mapViewState";
import { MAP_HEIGHT } from "../styles/layout";
import { theme } from "../styles/theme";

type ContourPath = readonly (readonly [number, number])[];

interface MapContours {
  readonly obscurationContours: readonly {
    readonly paths: readonly ContourPath[];
    readonly percent: number;
  }[];
  readonly timeContours: readonly {
    readonly label: string;
    readonly paths: readonly ContourPath[];
  }[];
}

interface MapPanelProps {
  bounds: MapBounds;
  candidates?: readonly GeoPoint[];
  contours: MapContours;
  initialCamera?: MapCamera | null;
  location: GeoPoint;
  onLocationChange: (location: GeoPoint) => void;
  onCameraChange?: (camera: MapCamera) => void;
  onRegionChange?: (regionId: string) => void;
  path: EclipsePathGeometry;
  regionOptions?: readonly MapRegionOption[] | undefined;
  selectedRegionId?: string | undefined;
  totalitySummary?: string;
}

const coordinates = (points: readonly GeoPoint[]): GeoPoint[] =>
  points.map(({ latitude, longitude }) => ({ latitude, longitude }));

const contourCoordinates = (path: ContourPath): GeoPoint[] =>
  path.map(([latitude, longitude]) => ({ latitude, longitude }));

const boundsCoordinates = ({ east, north, south, west }: MapBounds): GeoPoint[] => [
  { latitude: north, longitude: west },
  { latitude: north, longitude: east },
  { latitude: south, longitude: east },
  { latitude: south, longitude: west },
];

const initialRegion = ({ east, north, south, west }: MapBounds) => ({
  latitude: (north + south) / 2,
  latitudeDelta: Math.max(1, (north - south) * 1.15),
  longitude: (east + west) / 2,
  longitudeDelta: Math.max(1, (east - west) * 1.15),
});

const cameraRegion = (camera: MapCamera) => ({
  latitude: camera.center.latitude,
  latitudeDelta: camera.latitudeDelta,
  longitude: camera.center.longitude,
  longitudeDelta: camera.longitudeDelta,
});

const edgePadding = { bottom: 36, left: 28, right: 28, top: 52 };

export const MapPanel = ({
  bounds,
  candidates = [],
  contours,
  initialCamera = null,
  location,
  onLocationChange,
  onCameraChange,
  onRegionChange,
  path,
  totalitySummary = "Current point",
  regionOptions,
  selectedRegionId,
}: MapPanelProps) => {
  const mapRef = useRef<MapView | null>(null);
  const mapReady = useRef(false);
  const previousLocation = useRef(location);
  const [showFullPath, setShowFullPath] = useState(true);
  const selectedRegion = regionOptions?.find(
    (option) => option.id === selectedRegionId,
  );

  const fitExtent = useCallback(
    (fullPath: boolean, animated: boolean) => {
      const nextCoordinates = fullPath
        ? coordinates(path.totalityArea)
        : boundsCoordinates(bounds);
      if (nextCoordinates.length === 0) return;
      mapRef.current?.fitToCoordinates(nextCoordinates, {
        animated,
        edgePadding,
      });
    },
    [bounds, path.totalityArea],
  );

  useEffect(() => {
    if (mapReady.current && !regionOptions) fitExtent(showFullPath, true);
  }, [fitExtent, regionOptions]);

  useEffect(() => {
    const changed =
      previousLocation.current.latitude !== location.latitude ||
      previousLocation.current.longitude !== location.longitude;
    previousLocation.current = location;
    if (changed && mapReady.current) {
      mapRef.current?.animateCamera(
        { center: location },
        { duration: 250 },
      );
    }
  }, [location]);

  const selectExtent = (fullPath: boolean) => {
    setShowFullPath(fullPath);
    if (mapReady.current) fitExtent(fullPath, true);
  };

  const selectRegion = (regionId: string) => {
    const region = regionOptions?.find((option) => option.id === regionId);
    if (!region) return;
    onRegionChange?.(regionId);
    if (mapReady.current) {
      mapRef.current?.fitToCoordinates(boundsCoordinates(region.bounds), {
        animated: true,
        edgePadding,
      });
    }
  };

  const handleMapPress = ({ nativeEvent }: MapPressEvent) => {
    onLocationChange({
      latitude: nativeEvent.coordinate.latitude,
      longitude: nativeEvent.coordinate.longitude,
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        initialRegion={initialCamera ? cameraRegion(initialCamera) : initialRegion(bounds)}
        loadingEnabled
        moveOnMarkerPress={false}
        onMapReady={() => {
          mapReady.current = true;
          if (selectedRegion && !initialCamera) {
            mapRef.current?.fitToCoordinates(boundsCoordinates(selectedRegion.bounds), {
              animated: false,
              edgePadding,
            });
          } else if (!initialCamera) {
            fitExtent(showFullPath, false);
          }
        }}
        onRegionChangeComplete={(region) =>
          onCameraChange?.({
            center: { latitude: region.latitude, longitude: region.longitude },
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
            zoom: 0,
          })
        }
        onPress={handleMapPress}
        pitchEnabled={false}
        ref={mapRef}
        rotateEnabled={false}
        style={styles.map}
        toolbarEnabled={false}
      >
        {contours.obscurationContours.map((contour, contourIndex) =>
          contour.paths.map((contourPath, pathIndex) =>
            contourIndex === 0 ? (
              <Polygon
                coordinates={contourCoordinates(contourPath)}
                fillColor="rgba(85, 186, 244, 0.07)"
                key={`partial-area:${pathIndex}`}
                strokeColor="rgba(85, 186, 244, 0.65)"
                strokeWidth={1}
              />
            ) : (
              <Polyline
                coordinates={contourCoordinates(contourPath)}
                key={`obscuration:${contour.percent}:${pathIndex}`}
                strokeColor="rgba(85, 186, 244, 0.72)"
                strokeWidth={2}
              />
            ),
          ),
        )}
        {contours.timeContours.flatMap((contour) =>
          contour.paths.map((contourPath, pathIndex) => (
            <Polyline
              coordinates={contourCoordinates(contourPath)}
              key={`time:${contour.label}:${pathIndex}`}
              strokeColor="rgba(101, 214, 166, 0.8)"
              strokeWidth={2}
            />
          )),
        )}
        <Polygon
          coordinates={coordinates(path.totalityArea)}
          fillColor="rgba(255, 201, 77, 0.24)"
          strokeColor="rgba(255, 230, 154, 0.75)"
          strokeWidth={1}
        />
        <Polyline
          coordinates={coordinates(path.northernLimit)}
          lineDashPattern={[5, 6]}
          strokeColor="rgba(247, 242, 223, 0.9)"
          strokeWidth={2}
        />
        <Polyline
          coordinates={coordinates(path.southernLimit)}
          lineDashPattern={[5, 6]}
          strokeColor="rgba(247, 242, 223, 0.9)"
          strokeWidth={2}
        />
        <Polyline
          coordinates={coordinates(path.centerLine)}
          strokeColor="rgba(255, 201, 77, 0.9)"
          strokeWidth={3}
        />
        {path.centerLine
          .filter((point) => point.timeUtc?.endsWith(":00Z"))
          .map((point) => (
            <Marker
              anchor={{ x: 0.5, y: 1 }}
              coordinate={point}
              identifier={`path-time:${point.timeUtc}`}
              key={`path-time:${point.timeUtc}`}
              tracksViewChanges={false}
              zIndex={10}
            >
              <View style={styles.timeMarker}>
                <Text style={styles.timeMarkerText}>{point.timeUtc}</Text>
                <View style={styles.timeMarkerDot} />
              </View>
            </Marker>
          ))}
        {candidates.map((candidate, index) => (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={candidate}
            identifier={`candidate:${candidate.latitude}:${candidate.longitude}`}
            key={`${candidate.latitude}:${candidate.longitude}`}
            tracksViewChanges={false}
            zIndex={15}
          >
            <View
              style={[
                styles.candidateMarker,
                index === 0 ? styles.bestCandidateMarker : null,
              ]}
            />
          </Marker>
        ))}
        <Marker
          anchor={{ x: 0.5, y: 0.5 }}
          coordinate={location}
          identifier="selected-location"
          tracksViewChanges={false}
          zIndex={30}
        >
          <View style={styles.selectedMarker} />
          <Callout>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>Selected location</Text>
              <Text>{totalitySummary}</Text>
            </View>
          </Callout>
        </Marker>
      </MapView>

      <View accessibilityRole="radiogroup" style={styles.extentControl}>
        {regionOptions ? regionOptions.map((region) => (
          <Pressable
            accessibilityLabel={`Show ${region.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedRegionId === region.id }}
            key={region.id}
            onPress={() => selectRegion(region.id)}
            style={({ pressed }) => [
              styles.extentOption,
              selectedRegionId === region.id ? styles.extentOptionSelected : null,
              pressed ? styles.extentOptionPressed : null,
            ]}
          >
            <Text style={styles.extentOptionText}>{region.label}</Text>
          </Pressable>
        )) : null}
        {!regionOptions ? <Pressable
          accessibilityLabel="Show full eclipse path"
          accessibilityRole="radio"
          accessibilityState={{ checked: showFullPath }}
          onPress={() => selectExtent(true)}
          style={({ pressed }) => [
            styles.extentOption,
            showFullPath ? styles.extentOptionSelected : null,
            pressed ? styles.extentOptionPressed : null,
          ]}
        >
          <Text style={styles.extentOptionText}>Full path</Text>
        </Pressable> : null}
        {!regionOptions ? <Pressable
          accessibilityLabel="Show selected region"
          accessibilityRole="radio"
          accessibilityState={{ checked: !showFullPath }}
          onPress={() => selectExtent(false)}
          style={({ pressed }) => [
            styles.extentOption,
            !showFullPath ? styles.extentOptionSelected : null,
            pressed ? styles.extentOptionPressed : null,
          ]}
        >
          <Text style={styles.extentOptionText}>Region</Text>
        </Pressable> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bestCandidateMarker: {
    backgroundColor: "#d68cff",
    height: 16,
    width: 16,
  },
  callout: {
    maxWidth: 240,
    padding: 4,
  },
  calloutTitle: {
    fontWeight: "700",
    marginBottom: 2,
  },
  candidateMarker: {
    backgroundColor: "#65d6a6",
    borderColor: theme.color.background,
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  container: {
    height: MAP_HEIGHT,
    position: "relative",
    width: "100%",
  },
  extentControl: {
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.border,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    left: theme.space.small,
    overflow: "hidden",
    position: "absolute",
    top: theme.space.small,
  },
  extentOption: {
    minHeight: 36,
    paddingHorizontal: theme.space.small,
    paddingVertical: theme.space.xsmall,
  },
  extentOptionPressed: {
    opacity: 0.78,
  },
  extentOptionSelected: {
    backgroundColor: theme.color.accent,
  },
  extentOptionText: {
    color: theme.color.text,
    fontSize: 12,
    fontWeight: "700",
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  selectedMarker: {
    backgroundColor: "#7cc7ff",
    borderColor: theme.color.background,
    borderRadius: 999,
    borderWidth: 3,
    height: 20,
    width: 20,
  },
  timeMarker: {
    alignItems: "center",
  },
  timeMarkerDot: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.background,
    borderRadius: 999,
    borderWidth: 1,
    height: 8,
    width: 8,
  },
  timeMarkerText: {
    backgroundColor: theme.color.surfaceRaised,
    borderColor: theme.color.border,
    borderRadius: 4,
    borderWidth: 1,
    color: theme.color.text,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
});
