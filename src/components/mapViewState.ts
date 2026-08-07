import type { GeoPoint } from "../domain/geo";
import type { MapBounds } from "../data/eclipseEvents";

export interface MapCamera {
  center: GeoPoint;
  latitudeDelta: number;
  longitudeDelta: number;
  zoom: number;
}

export interface MapRegionOption {
  bounds: MapBounds;
  id: string;
  label: string;
}
