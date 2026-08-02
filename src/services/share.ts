import QRCode from "qrcode";

import {
  ECLIPSE_EVENTS,
  type EclipseEventId,
} from "../data/eclipseEvents";
import { isValidGeoPoint, type GeoPoint } from "../domain/geo";

export interface SharedSelection {
  eventId: EclipseEventId;
  location: GeoPoint;
}

const isEventId = (value: string): value is EclipseEventId =>
  ECLIPSE_EVENTS.some((event) => event.id === value);

export const readSharedSelection = (): SharedSelection | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URL(window.location.href).searchParams;
  const eventId = params.get("event");
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  const location = { latitude, longitude };

  return eventId && isEventId(eventId) && isValidGeoPoint(location)
    ? { eventId, location }
    : null;
};

export const updateShareUrl = (
  eventId: EclipseEventId,
  location: GeoPoint,
): string => {
  if (typeof window === "undefined") {
    return "";
  }
  const url = new URL(window.location.href);
  url.searchParams.set("event", eventId);
  url.searchParams.set("lat", location.latitude.toFixed(5));
  url.searchParams.set("lon", location.longitude.toFixed(5));
  window.history.replaceState(null, "", url);
  return url.toString();
};

export const makeQrCode = (value: string): Promise<string> =>
  QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: { dark: "#081018", light: "#f7f2df" },
  });

export const copyText = async (value: string): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  await navigator.clipboard.writeText(value);
  return true;
};
