import type { FetchFunction } from "./result";

const INITIAL_BACKOFF_MILLISECONDS = 1_000;
const MAXIMUM_RETRIES = 3;

type DelayFunction = (
  milliseconds: number,
  signal: AbortSignal | null | undefined,
) => Promise<void>;

interface RateLimitBackoffOptions {
  delay?: DelayFunction;
  initialBackoffMilliseconds?: number;
  maximumRetries?: number;
}

const abortError = (): Error => {
  const error = new Error("Request aborted.");
  error.name = "AbortError";
  return error;
};

const delay: DelayFunction = (milliseconds, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const retryAfterMilliseconds = (response: Response): number => {
  const value = response.headers.get("Retry-After");
  if (!value) {
    return 0;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }
  const retryUtc = Date.parse(value);
  return Number.isFinite(retryUtc) ? Math.max(0, retryUtc - Date.now()) : 0;
};

const discardResponse = async (response: Response): Promise<void> => {
  if (!response.body || response.bodyUsed) {
    return;
  }
  try {
    await response.body.cancel();
  } catch {
    // Backoff must continue even when a provider body cannot be discarded.
  }
};

export const fetchWithRateLimitBackoff = async (
  fetchFunction: FetchFunction,
  input: string | URL | Request,
  init?: RequestInit,
  options: RateLimitBackoffOptions = {},
): Promise<Response> => {
  const wait = options.delay ?? delay;
  const initialBackoff =
    options.initialBackoffMilliseconds ?? INITIAL_BACKOFF_MILLISECONDS;
  const maximumRetries = options.maximumRetries ?? MAXIMUM_RETRIES;
  let retries = 0;
  let backoffMilliseconds = initialBackoff;

  while (true) {
    const response = await fetchFunction(input, init);
    if (response.status !== 429 || retries >= maximumRetries) {
      return response;
    }

    const waitMilliseconds = Math.max(
      backoffMilliseconds,
      retryAfterMilliseconds(response),
    );
    retries += 1;
    backoffMilliseconds = Math.min(
      Number.MAX_SAFE_INTEGER,
      waitMilliseconds * 2,
    );
    await discardResponse(response);
    await wait(waitMilliseconds, init?.signal);
  }
};
