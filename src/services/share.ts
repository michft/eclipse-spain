import QRCode from "qrcode";

import {
  ECLIPSE_EVENTS,
  type EclipseEventId,
} from "../data/eclipseEvents";
import { isValidGeoPoint, type GeoPoint } from "../domain/geo";
import type { ServiceResult } from "./result";

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
  const latitudeParam = params.get("lat");
  const longitudeParam = params.get("lon");
  if (!latitudeParam?.trim() || !longitudeParam?.trim()) {
    return null;
  }
  const latitude = Number(latitudeParam);
  const longitude = Number(longitudeParam);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
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

export const makeQrCode = async (
  value: string,
): Promise<ServiceResult<string>> => {
  try {
    return {
      status: "success",
      value: await QRCode.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 360,
        color: { dark: "#081018", light: "#f7f2df" },
      }),
    };
  } catch {
    return { status: "error", reason: "QR code could not be generated." };
  }
};

export const copyText = async (value: string): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};
