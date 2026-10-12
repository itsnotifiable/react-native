import { NotifiableError } from "../domain/errors";
import { isRecord } from "../domain/record";
import {
  isDevicePlatform,
  isPermissionStatus,
  isPushProvider,
  type DeliveryConfig,
  type Subscriber,
  type SubscriberIdentity,
  type SubscriberWrite,
} from "../domain/subscriber";
import type { HttpClient } from "./types";

export interface SdkApi {
  getClientConfig(): Promise<DeliveryConfig>;
  saveSubscriber(write: SubscriberWrite): Promise<Subscriber>;
  updateSubscriber(
    subscriberId: string,
    identity: SubscriberIdentity,
  ): Promise<Subscriber>;
}

export function createSdkApi(http: HttpClient): SdkApi {
  return {
    async getClientConfig(): Promise<DeliveryConfig> {
      const data = await http.request({
        method: "GET",
        path: "/v1/sdk/client-config",
      });

      return parseDeliveryConfig(data);
    },

    async saveSubscriber(write: SubscriberWrite): Promise<Subscriber> {
      const data = await http.request({
        method: "POST",
        path: "/v1/sdk/subscribers",
        body: subscriberBody(write),
      });

      return parseSubscriber(data);
    },

    async updateSubscriber(
      subscriberId: string,
      identity: SubscriberIdentity,
    ): Promise<Subscriber> {
      const data = await http.request({
        method: "PATCH",
        path: `/v1/sdk/subscribers/${encodeURIComponent(subscriberId)}`,
        body: identityBody(identity),
      });

      return parseSubscriber(data);
    },
  };
}

function subscriberBody(
  write: SubscriberWrite,
): Readonly<Record<string, unknown>> {
  return omitUndefined({
    device_id: write.deviceId,
    platform: write.platform,
    sdk: "react-native",
    permission: write.permission,
    provider: write.provider,
    token: write.token,
    anonymous_id: write.anonymousId,
    prompted: write.prompted,
    os_version: write.osVersion,
    locale: write.locale,
    timezone: write.timezone,
  });
}

function identityBody(
  identity: SubscriberIdentity,
): Readonly<Record<string, unknown>> {
  return omitUndefined({
    email: identity.email,
    external_id: identity.externalId,
    first_name: identity.firstName,
    last_name: identity.lastName,
    anonymous_id: identity.anonymousId,
  });
}

function omitUndefined(
  values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] !== undefined),
  );
}

function parseDeliveryConfig(data: unknown): DeliveryConfig {
  if (!isRecord(data)) {
    throw new NotifiableError({
      code: "network",
      message: "The client configuration response was invalid.",
    });
  }

  return {
    android: recordOrNull(data.android),
    ios: recordOrNull(data.ios),
    web: recordOrNull(data.web),
  };
}

function parseSubscriber(data: unknown): Subscriber {
  if (
    !isRecord(data) ||
    typeof data.id !== "string" ||
    typeof data.environment !== "string" ||
    !isDevicePlatform(data.platform) ||
    !isPermissionStatus(data.permission) ||
    typeof data.prompt_permission !== "boolean"
  ) {
    throw new NotifiableError({
      code: "network",
      message: "The subscriber response was invalid.",
    });
  }

  const provider = data.provider ?? null;

  if (provider !== null && !isPushProvider(provider)) {
    throw new NotifiableError({
      code: "network",
      message: "The subscriber response was invalid.",
    });
  }

  return {
    id: data.id,
    environment: data.environment,
    platform: data.platform,
    permission: data.permission,
    sdk: typeof data.sdk === "string" ? data.sdk : null,
    provider,
    deviceId: typeof data.device_id === "string" ? data.device_id : null,
    externalId: typeof data.external_id === "string" ? data.external_id : null,
    anonymousId:
      typeof data.anonymous_id === "string" ? data.anonymous_id : null,
    promptPermission: data.prompt_permission,
  };
}

function recordOrNull(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  return isRecord(value) ? value : null;
}
