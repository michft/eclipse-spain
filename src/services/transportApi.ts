import { isValidGeoPoint, type GeoPoint } from "../domain/geo";
import type { FetchFunction } from "./result";
import {
  makeTransportQuery,
  OVERPASS_FALLBACK_PROVIDER_URL,
  OVERPASS_PROVIDER_URL,
  OVERPASS_USER_AGENT,
} from "./overpass";
import { createRequestTimeout } from "./requestTimeout";

const OVERPASS_TOTAL_TIMEOUT_MILLISECONDS = 30_000;
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
  signal: AbortSignal,
): Promise<Response> => {
  return fetchFunction(providerUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": OVERPASS_USER_AGENT,
    },
    body,
    signal,
  });
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

  const timeout = createRequestTimeout(OVERPASS_TOTAL_TIMEOUT_MILLISECONDS);
  try {
    const body = `data=${encodeURIComponent(makeTransportQuery(location))}`;
    let primary: Response | null = null;
    try {
      primary = await fetchProvider(
        OVERPASS_PROVIDER_URL,
        body,
        fetchFunction,
        timeout.signal,
      );
    } catch {
      // Network and timeout failures use the same bounded fallback path.
    }
    let response: Response;
    if (primary === null) {
      response = await fetchProvider(
        OVERPASS_FALLBACK_PROVIDER_URL,
        body,
        fetchFunction,
        timeout.signal,
      );
    } else if (!primary.ok && primary.status >= 500) {
      await releaseResponse(primary);
      response = await fetchProvider(
        OVERPASS_FALLBACK_PROVIDER_URL,
        body,
        fetchFunction,
        timeout.signal,
      );
    } else {
      response = primary;
    }
    const retryAfter = response.headers.get("Retry-After");
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        ...(retryAfter ? { "Retry-After": retryAfter } : {}),
      },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonError(
      timedOut ? "Transport provider timed out." : "Transport provider failed.",
      timedOut ? 504 : 502,
    );
  } finally {
    timeout.clear();
    permit.release();
  }
};
