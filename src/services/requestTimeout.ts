export interface RequestTimeout {
  signal: AbortSignal;
  clear: () => void;
}

export const createRequestTimeout = (milliseconds: number): RequestTimeout => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
};
