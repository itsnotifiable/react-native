import { resolveLogger } from "../internal/logger";
import type { PlatformAdapter } from "../platform/types";
import type { HttpClient } from "../transport/types";
import type { NotifiableClient, NotifiableConfig } from "./types";

export class NotifiableClientImpl implements NotifiableClient {
  readonly config: NotifiableConfig;
  readonly #http: HttpClient;
  readonly #platform: PlatformAdapter;

  constructor(
    config: NotifiableConfig,
    http: HttpClient,
    platform: PlatformAdapter,
  ) {
    this.config = config;
    this.#http = http;
    this.#platform = platform;
    resolveLogger(config.logger).debug("Notifiable client created", {
      hasBaseUrl: config.baseUrl !== undefined,
      transport: typeof this.#http.request,
      platform: typeof this.#platform.getDeviceToken,
    });
  }
}
