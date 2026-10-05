export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
}

export interface HttpResponse<TBody> {
  readonly status: number;
  readonly body: TBody;
}

export interface HttpClient {
  request<TBody>(request: HttpRequest): Promise<HttpResponse<TBody>>;
}
