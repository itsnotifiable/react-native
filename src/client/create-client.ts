import { notifiableBaseUrls } from "../domain/environment";
import { invariant } from "../internal/assert";
import { createDevicePort } from "../platform/create-device";
import { createHttpClient, stripTrailingSlash } from "../transport/http-client";
import { createSdkApi } from "../transport/sdk-api";
import { NotifiableClientImpl } from "./notifiable-client";
import type { NotifiableClient, NotifiableConfig } from "./types";

export function createNotifiable(config: NotifiableConfig): NotifiableClient {
  const publicKey = config.publicKey.trim();
  invariant(publicKey.length > 0, "invalid_config", "publicKey is required");

  const baseUrl = resolveBaseUrl(config);

  return new NotifiableClientImpl(
    copyConfig(config, publicKey, baseUrl),
    createSdkApi(
      createHttpClient({
        baseUrl,
        publicKey,
      }),
    ),
    config.device ?? createDevicePort(),
    config.storage,
  );
}

function resolveBaseUrl(config: NotifiableConfig): string {
  if (config.baseUrl !== undefined) {
    const baseUrl = stripTrailingSlash(config.baseUrl.trim());
    invariant(baseUrl.length > 0, "invalid_config", "baseUrl cannot be blank");
    return baseUrl;
  }

  return notifiableBaseUrls[config.environment ?? "production"];
}

function copyConfig(
  config: NotifiableConfig,
  publicKey: string,
  baseUrl: string,
): NotifiableConfig {
  const environment =
    config.environment ??
    (config.baseUrl === undefined ? "production" : undefined);

  return {
    publicKey,
    baseUrl,
    ...(environment !== undefined ? { environment } : {}),
    ...(config.logger !== undefined ? { logger: config.logger } : {}),
    ...(config.push !== undefined ? { push: config.push } : {}),
    ...(config.storage !== undefined ? { storage: config.storage } : {}),
    ...(config.device !== undefined ? { device: config.device } : {}),
  };
}
