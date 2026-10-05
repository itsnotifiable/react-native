import { asAppKey } from "../domain/identifiers";
import { invariant } from "../internal/assert";
import { createPlatformAdapter } from "../platform/create-platform";
import {
  createHttpClient,
  type HttpClientOptions,
} from "../transport/http-client";
import { NotifiableClientImpl } from "./notifiable-client";
import type { NotifiableClient, NotifiableConfig } from "./types";

export function createNotifiable(config: NotifiableConfig): NotifiableClient {
  const appKey = config.appKey.trim();
  invariant(appKey.length > 0, "invalid_config", "appKey is required");

  const resolved = copyConfig(config, asAppKey(appKey));

  return new NotifiableClientImpl(
    resolved,
    createHttpClient(httpOptionsFrom(resolved)),
    createPlatformAdapter(),
  );
}

function httpOptionsFrom(config: NotifiableConfig): HttpClientOptions {
  if (config.baseUrl === undefined) {
    return {};
  }

  return { baseUrl: config.baseUrl };
}

function copyConfig(
  config: NotifiableConfig,
  appKey: string,
): NotifiableConfig {
  return {
    appKey,
    ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
    ...(config.logger !== undefined ? { logger: config.logger } : {}),
  };
}
