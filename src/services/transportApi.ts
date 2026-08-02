import { isValidGeoPoint, type GeoPoint } from "../domain/geo";
import type { FetchFunction } from "./result";
import {
  makeTransportQuery,
  OVERPASS_FALLBACK_PROVIDER_URL,
  OVERPASS_PROVIDER_URL,
  OVERPASS_USER_AGENT,
} from "./overpass";
import { createRequestTimeout } from "./requestTimeout";

const OVERPASS_ATTEMPT_TIMEOUT_MILLISECONDS = 30_000;
const TRANSPORT_REQUEST_LIMIT = 10;
const TRANSPORT_RATE_WINDOW_MILLISECONDS = 1_000;

interface TransportRequestPermit {
  release: () => void;
}

export interface TransportRequestLimiter {
  acquire: (nowMilliseconds?: number) => TransportRequestPermit | null;
}

export const createTransportRequestLimiter = (): TransportRequestLimiter => {
  let activeRequests = 0;
  let recentStarts: number[] = [];
  return {
    acquire: (nowMilliseconds = Date.now()) => {
      recentStarts = recentStarts.filter(
        (started) =>
          started <= nowMilliseconds &&
          started > nowMilliseconds - TRANSPORT_RATE_WINDOW_MILLISECONDS,
      );
      if (
        activeRequests >= TRANSPORT_REQUEST_LIMIT ||
        recentStarts.length >= TRANSPORT_REQUEST_LIMIT
      ) {
        return null;
      }
      activeRequests += 1;
      recentStarts.push(nowMilliseconds);
      let released = false;
      return {
        release: () => {
          if (!released) {
            released = true;
            activeRequests -= 1;
          }
        },
      };
    },
  };
};

const requestLimiter = createTransportRequestLimiter();

const jsonError = (
  reason: string,
  status: number,
  extraHeaders: HeadersInit = {},
): Response =>
  Response.json(
    { reason },
    {
      status,
      headers: { "Cache-Control": "no-store", ...extraHeaders },
    },
  );

const readLocation = (request: Request): GeoPoint | null => {
  const search = new URL(request.url).searchParams;
  const latitudeInput = search.get("latitude");
  const longitudeInput = search.get("longitude");
  if (!latitudeInput?.trim() || !longitudeInput?.trim()) {
    return null;
  }
  const location = {
    latitude: Number(latitudeInput),
    longitude: Number(longitudeInput),
  };
  return isValidGeoPoint(location) ? location : null;
};

const fetchProvider = async (
  providerUrl: string,
  body: string,
  fetchFunction: FetchFunction,
): Promise<Response> => {
  const timeout = createRequestTimeout(OVERPASS_ATTEMPT_TIMEOUT_MILLISECONDS);
  try {
    return await fetchFunction(providerUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body,
      signal: timeout.signal,
    });
  } finally {
    timeout.clear();
  }
};

const releaseResponse = async (response: Response): Promise<void> => {
  if (!response.body || response.bodyUsed) {
    return;
  }
  try {
    await response.body.cancel();
  } catch {
    // A failed discard must not prevent the fallback request.
  }
};

export const handleTransportRequest = async (
  request: Request,
  fetchFunction: FetchFunction = fetch,
  limiter: TransportRequestLimiter = requestLimiter,
): Promise<Response> => {
  if (request.method !== "GET") {
    return jsonError("Method not allowed.", 405);
  }
  const location = readLocation(request);
  if (!location) {
    return jsonError("Latitude or longitude is invalid.", 400);
  }

  const permit = limiter.acquire();
  if (!permit) {
    return jsonError("Transport request limit reached. Retry shortly.", 429, {
      "Retry-After": "1",
    });
  }

  try {
    const body = `data=${encodeURIComponent(makeTransportQuery(location))}`;
    const primary = await fetchProvider(
      OVERPASS_PROVIDER_URL,
      body,
      fetchFunction,
    );
    let response = primary;
    if (!primary.ok && primary.status >= 500) {
      await releaseResponse(primary);
      response = await fetchProvider(
        OVERPASS_FALLBACK_PROVIDER_URL,
        body,
        fetchFunction,
      );
    }
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonError(
      timedOut ? "Transport provider timed out." : "Transport provider failed.",
      timedOut ? 504 : 502,
    );
  } finally {
    permit.release();
  }
};
