export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
}

export interface FetchInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: FetchInit,
) => Promise<FetchResponse>;

export interface HttpClient {
  request(request: HttpRequest): Promise<unknown>;
}
