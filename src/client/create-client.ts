import { notifiableApiUrl } from "../domain/environment";
import { invariant } from "../internal/assert";
import { createDevicePort } from "../platform/create-device";
import { createHttpClient } from "../transport/http-client";
import { createSdkApi } from "../transport/sdk-api";
import { NotifiableClientImpl } from "./notifiable-client";
import type { NotifiableClient, NotifiableConfig } from "./types";

export function createNotifiable(config: NotifiableConfig): NotifiableClient {
  const publicKey = config.publicKey.trim();
  invariant(publicKey.length > 0, "invalid_config", "publicKey is required");

  return new NotifiableClientImpl(
    copyConfig(config, publicKey),
    createSdkApi(
      createHttpClient({
        baseUrl: notifiableApiUrl,
        publicKey,
      }),
    ),
    config.device ?? createDevicePort(),
    config.storage,
  );
}

function copyConfig(
  config: NotifiableConfig,
  publicKey: string,
): NotifiableConfig {
  return {
    publicKey,
    ...(config.logger !== undefined ? { logger: config.logger } : {}),
    ...(config.push !== undefined ? { push: config.push } : {}),
    ...(config.storage !== undefined ? { storage: config.storage } : {}),
    ...(config.device !== undefined ? { device: config.device } : {}),
    ...(config.deepLinks !== undefined ? { deepLinks: config.deepLinks } : {}),
    ...(config.onDeepLink !== undefined
      ? { onDeepLink: config.onDeepLink }
      : {}),
  };
}
