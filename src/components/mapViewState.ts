import type { GeoPoint } from "../domain/geo";

export interface MapCamera {
  center: GeoPoint;
  latitudeDelta: number;
  longitudeDelta: number;
  zoom: number;
}
