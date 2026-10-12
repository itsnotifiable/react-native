import { NotifiableError, type NotifiableErrorCode } from "../domain/errors";
import { isRecord } from "../domain/record";
import type {
  FetchLike,
  FetchResponse,
  HttpClient,
  HttpRequest,
} from "./types";

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly publicKey: string;
  readonly fetch?: FetchLike;
}

const apiErrorCodes: Readonly<Record<string, NotifiableErrorCode>> = {
  INVALID_PUBLIC_KEY: "invalid_public_key",
  VALIDATION_FAILED: "validation_failed",
  SUBSCRIBER_NOT_FOUND: "subscriber_not_found",
  SUBSCRIBER_LIMIT_REACHED: "subscriber_limit",
  RATE_LIMIT_EXCEEDED: "rate_limited",
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const baseUrl = stripTrailingSlash(options.baseUrl);
  const fetchImpl = options.fetch ?? globalFetch;

  return {
    async request(request: HttpRequest): Promise<unknown> {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Notifiable-Key": options.publicKey,
      };
      let body: string | undefined;

      if (request.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(request.body);
      }

      let response: FetchResponse;

      try {
        response = await fetchImpl(joinUrl(baseUrl, request.path), {
          method: request.method,
          headers,
          ...(body !== undefined ? { body } : {}),
        });
      } catch (error) {
        throw new NotifiableError({
          code: "network",
          message:
            error instanceof Error ? error.message : "The request failed.",
        });
      }

      return readEnvelope(response);
    },
  };
}

function globalFetch(
  url: string,
  init?: Parameters<FetchLike>[1],
): Promise<FetchResponse> {
  const fetchImpl = (globalThis as { fetch?: FetchLike }).fetch;

  if (fetchImpl === undefined) {
    return Promise.reject(
      new NotifiableError({
        code: "network",
        message: "fetch is not available.",
      }),
    );
  }

  return fetchImpl(url, init);
}

async function readEnvelope(response: FetchResponse): Promise<unknown> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new NotifiableError({
      code: "network",
      message: "The response was not JSON.",
    });
  }

  if (!isRecord(payload) || typeof payload.status !== "string") {
    throw new NotifiableError({
      code: "network",
      message: "The response envelope was invalid.",
    });
  }

  if (payload.status === "success") {
    return payload.data;
  }

  const code = typeof payload.code === "string" ? payload.code : "";
  const mapped = apiErrorCodes[code] ?? "network";
  const fallback =
    typeof payload.message === "string"
      ? payload.message
      : "The request failed.";

  throw new NotifiableError({
    code: mapped,
    message: errorMessage(payload.error, fallback),
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (!isRecord(error) || !Array.isArray(error.details)) {
    return fallback;
  }

  const details = error.details.flatMap((detail) => {
    if (!isRecord(detail) || typeof detail.message !== "string") {
      return [];
    }

    return [detail.message];
  });

  return details.length > 0 ? details.join(" ") : fallback;
}

export function joinUrl(baseUrl: string, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${suffix}`;
}

export function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
