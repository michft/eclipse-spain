import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Pane,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { MapBounds } from "../data/eclipseEvents";
import type { EclipsePathGeometry } from "../data/eclipsePaths";
import type { GeoPoint } from "../domain/geo";
import { MAP_HEIGHT } from "../styles/layout";
import { theme } from "../styles/theme";
import type { MapCamera } from "./mapViewState";

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
  path: EclipsePathGeometry;
  totalitySummary?: string;
}

const unwrapLongitudes = (
  points: readonly GeoPoint[],
): [number, number][] => {
  let previousLongitude: number | null = null;
  return points.map((point) => {
    let longitude = point.longitude;
    if (previousLongitude !== null) {
      while (longitude - previousLongitude > 180) longitude -= 360;
      while (longitude - previousLongitude < -180) longitude += 360;
    }
    previousLongitude = longitude;
    return [point.latitude, longitude];
  });
};

const fullPathBounds = (path: EclipsePathGeometry): MapBounds => {
  const positions = unwrapLongitudes(path.totalityArea);
  return {
    north: Math.max(...positions.map(([latitude]) => latitude)),
    east: Math.max(...positions.map(([, longitude]) => longitude)),
    south: Math.min(...positions.map(([latitude]) => latitude)),
    west: Math.min(...positions.map(([, longitude]) => longitude)),
  };
};

const fitBounds = (map: ReturnType<typeof useMap>, bounds: MapBounds): void => {
  map.fitBounds(
    L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east],
    ),
    { padding: [18, 18] },
  );
};

const FitEventBounds = ({ bounds, enabled }: { bounds: MapBounds; enabled: boolean }) => {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    fitBounds(map, bounds);
  }, [bounds, enabled, map]);
  return null;
};

const FitRequestedExtent = ({
  bounds,
  request,
}: {
  bounds: MapBounds;
  request: number;
}) => {
  const map = useMap();
  useEffect(() => {
    if (request === 0) return;
    fitBounds(map, bounds);
  }, [bounds, map, request]);
  return null;
};

const TrackCamera = ({ onCameraChange }: { onCameraChange: ((camera: MapCamera) => void) | undefined }) => {
  const map = useMap();
  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCameraChange?.({
        center: { latitude: center.lat, longitude: center.lng },
        latitudeDelta: 0,
        longitudeDelta: 0,
        zoom: map.getZoom(),
      });
    },
  });
  return null;
};

const KeepLocationVisible = ({
  location,
  preserveCamera,
}: {
  location: GeoPoint;
  preserveCamera: boolean;
}) => {
  const map = useMap();
  const firstLocation = useRef(true);
  useEffect(() => {
    if (preserveCamera && firstLocation.current) {
      firstLocation.current = false;
      return;
    }
    firstLocation.current = false;
    const selectedPoint = L.latLng(location.latitude, location.longitude);
    if (!map.getBounds().contains(selectedPoint)) {
      map.panTo(selectedPoint);
    }
  }, [location, map]);
  return null;
};

const MapClick = ({
  onLocationChange,
}: Pick<MapPanelProps, "onLocationChange">) => {
  useMapEvents({
    click: ({ latlng }) => {
      onLocationChange({ latitude: latlng.lat, longitude: latlng.lng });
    },
  });
  return null;
};

export const MapPanel = ({
  bounds,
  candidates = [],
  contours,
  initialCamera = null,
  location,
  onLocationChange,
  onCameraChange,
  path,
  totalitySummary = "Current point",
}: MapPanelProps) => {
  const [showFullPath, setShowFullPath] = useState(true);
  const [extentRequest, setExtentRequest] = useState(0);
  return (
    <div style={{ height: MAP_HEIGHT, position: "relative", width: "100%" }}>
      <MapContainer
        center={[
          initialCamera?.center.latitude ?? location.latitude,
          initialCamera?.center.longitude ?? location.longitude,
        ]}
        scrollWheelZoom={false}
        style={{ height: MAP_HEIGHT, width: "100%" }}
        zoom={initialCamera?.zoom ?? 6}
      >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FitEventBounds
      bounds={showFullPath ? fullPathBounds(path) : bounds}
      enabled={!initialCamera && extentRequest === 0}
    />
    <FitRequestedExtent
      bounds={showFullPath ? fullPathBounds(path) : bounds}
      request={extentRequest}
    />
    <KeepLocationVisible location={location} preserveCamera={initialCamera !== null} />
    <TrackCamera onCameraChange={onCameraChange} />
    {contours.obscurationContours.map((contour, contourIndex) =>
      contour.paths.map((contourPath, pathIndex) =>
        contourIndex === 0 ? (
          <Polygon
            key={`partial-area:${pathIndex}`}
            pathOptions={{
              color: "#55baf4",
              fillColor: "#55baf4",
              fillOpacity: 0.07,
              opacity: 0.65,
              weight: 1,
            }}
            positions={contourPath.map(([latitude, longitude]) => [latitude, longitude])}
          >
            {pathIndex === 0 ? <Tooltip sticky>Partial eclipse observable</Tooltip> : null}
          </Polygon>
        ) : (
          <Polyline
            key={`obscuration:${contour.percent}:${pathIndex}`}
            pathOptions={{ color: "#55baf4", opacity: 0.72, weight: 1.5 }}
            positions={contourPath.map(([latitude, longitude]) => [latitude, longitude])}
          >
            {pathIndex === 0 ? (
              <Tooltip sticky>{contour.percent.toFixed(0)}% maximum obscuration</Tooltip>
            ) : null}
          </Polyline>
        ),
      ),
    )}
    {contours.timeContours.flatMap((contour) =>
      contour.paths.map((contourPath, pathIndex) => (
        <Polyline
          key={`time:${contour.label}:${pathIndex}`}
          pathOptions={{ color: "#65d6a6", opacity: 0.8, weight: 1.5 }}
          positions={contourPath.map(([latitude, longitude]) => [latitude, longitude])}
        >
          {pathIndex === 0 ? (
            <Tooltip direction="center" permanent>
              {contour.label}
            </Tooltip>
          ) : null}
        </Polyline>
      )),
    )}
    <Polygon
      pathOptions={{
        color: "#ffe69a",
        fillColor: "#ffc94d",
        fillOpacity: 0.24,
        opacity: 0.75,
        weight: 1,
      }}
      positions={unwrapLongitudes(path.totalityArea)}
    >
      <Tooltip sticky>100% totality area</Tooltip>
    </Polygon>
    <Polyline
      pathOptions={{ color: "#f7f2df", dashArray: "5 6", opacity: 0.9, weight: 2 }}
      positions={unwrapLongitudes(path.northernLimit)}
    />
    <Polyline
      pathOptions={{ color: "#f7f2df", dashArray: "5 6", opacity: 0.9, weight: 2 }}
      positions={unwrapLongitudes(path.southernLimit)}
    />
    <Polyline
      pathOptions={{ color: "#ffc94d", opacity: 0.9, weight: 3 }}
      positions={unwrapLongitudes(path.centerLine)}
    />
    {path.centerLine
      .filter((point) => point.timeUtc?.endsWith(":00Z"))
      .map((point) => (
        <CircleMarker
          center={[point.latitude, point.longitude]}
          key={`path-time:${point.timeUtc}`}
          pathOptions={{ color: "#081018", fillColor: "#ffc94d", fillOpacity: 1 }}
          radius={4}
          weight={1}
        >
          <Tooltip direction="top" permanent>
            {point.timeUtc}
          </Tooltip>
        </CircleMarker>
      ))}
    {candidates.map((candidate, index) => (
      <CircleMarker
        center={[candidate.latitude, candidate.longitude]}
        key={`${candidate.latitude}:${candidate.longitude}`}
        pathOptions={{
          color: "#081018",
          fillColor: index === 0 ? "#d68cff" : "#65d6a6",
          fillOpacity: 1,
        }}
        radius={index === 0 ? 8 : 6}
        weight={2}
      />
    ))}
    <Pane name="selected-location" style={{ zIndex: 640 }}>
      <CircleMarker
        center={[location.latitude, location.longitude]}
        pathOptions={{ color: "#081018", fillColor: "#7cc7ff", fillOpacity: 1 }}
        radius={9}
        weight={3}
      >
        <Tooltip pane="tooltipPane">{totalitySummary}</Tooltip>
      </CircleMarker>
    </Pane>
        <MapClick onLocationChange={onLocationChange} />
      </MapContainer>
      <div
        aria-label="Map extent controls"
        style={{ display: "flex", gap: 4, left: 52, position: "absolute", top: 12, zIndex: 1000 }}
      >
        <select
          aria-label="Map extent"
          onChange={(event) => {
            setShowFullPath(event.currentTarget.value === "full");
            setExtentRequest((request) => request + 1);
          }}
          style={mapControlStyle}
          value={showFullPath ? "full" : "region"}
        >
          <option value="full">Full eclipse path</option>
          <option value="region">Selected region</option>
        </select>
      </div>
    </div>
  );
};

const mapControlStyle = {
  background: theme.color.surfaceRaised,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 6,
  color: theme.color.text,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  minHeight: 34,
  padding: "6px 9px",
} as const;
