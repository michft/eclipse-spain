import { useEffect } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { MapBounds } from "../data/eclipseEvents";
import type { GeoPoint } from "../domain/geo";

interface MapPanelProps {
  bounds: MapBounds;
  candidates?: readonly GeoPoint[];
  centerLine: readonly GeoPoint[];
  location: GeoPoint;
  onLocationChange: (location: GeoPoint) => void;
}

const FitEventBounds = ({ bounds }: { bounds: MapBounds }) => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ),
      { padding: [18, 18] },
    );
  }, [bounds, map]);
  return null;
};

const KeepLocationVisible = ({ location }: { location: GeoPoint }) => {
  const map = useMap();
  useEffect(() => {
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
  centerLine,
  location,
  onLocationChange,
}: MapPanelProps) => (
  <MapContainer
    center={[location.latitude, location.longitude]}
    scrollWheelZoom
    style={{ height: 390, width: "100%" }}
    zoom={6}
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FitEventBounds bounds={bounds} />
    <KeepLocationVisible location={location} />
    <Polyline
      pathOptions={{ color: "#ffc94d", opacity: 0.9, weight: 3 }}
      positions={centerLine.map((point) => [point.latitude, point.longitude])}
    />
    <CircleMarker
      center={[location.latitude, location.longitude]}
      pathOptions={{ color: "#081018", fillColor: "#7cc7ff", fillOpacity: 1 }}
      radius={9}
      weight={3}
    />
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
    <MapClick onLocationChange={onLocationChange} />
  </MapContainer>
);
