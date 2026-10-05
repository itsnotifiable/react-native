import { NotifiableError } from "../domain/errors";
import type { HttpClient, HttpRequest, HttpResponse } from "./types";

export interface HttpClientOptions {
  readonly baseUrl?: string;
}

export function createHttpClient(_options: HttpClientOptions = {}): HttpClient {
  return {
    request<TBody>(_request: HttpRequest): Promise<HttpResponse<TBody>> {
      return Promise.reject(new NotifiableError({ code: "not_implemented" }));
    },
  };
}
