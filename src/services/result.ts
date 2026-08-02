export type ServiceResult<T> =
  | { status: "success"; value: T }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
