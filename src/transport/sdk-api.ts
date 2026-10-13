import type { DeepLink } from "../domain/deep-link";
import { NotifiableError } from "../domain/errors";
import type {
  InboxPage,
  InboxQuery,
  SubscriberNotification,
} from "../domain/inbox";
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
  listNotifications(
    subscriberId: string,
    query?: InboxQuery,
  ): Promise<InboxPage>;
  getNotification(
    subscriberId: string,
    notificationId: string,
  ): Promise<SubscriberNotification>;
  openNotification(subscriberId: string, notificationId: string): Promise<void>;
  clickDelivery(deliveryId: string): Promise<void>;
  saveDeepLinks(links: readonly DeepLink[]): Promise<readonly DeepLink[]>;
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

    async listNotifications(
      subscriberId: string,
      query?: InboxQuery,
    ): Promise<InboxPage> {
      const data = await http.request({
        method: "GET",
        path: inboxPath(subscriberId, query),
      });

      return parseInboxPage(data);
    },

    async getNotification(
      subscriberId: string,
      notificationId: string,
    ): Promise<SubscriberNotification> {
      const data = await http.request({
        method: "GET",
        path: `/v1/sdk/subscribers/${encodeURIComponent(subscriberId)}/notifications/${encodeURIComponent(notificationId)}`,
      });
      const notification = parseNotification(data);

      if (notification === null) {
        throw new NotifiableError({
          code: "network",
          message: "The notification response was invalid.",
        });
      }

      return notification;
    },

    async openNotification(
      subscriberId: string,
      notificationId: string,
    ): Promise<void> {
      await http.request({
        method: "POST",
        path: `/v1/sdk/subscribers/${encodeURIComponent(subscriberId)}/notifications/${encodeURIComponent(notificationId)}/open`,
      });
    },

    async clickDelivery(deliveryId: string): Promise<void> {
      await http.request({
        method: "POST",
        path: `/v1/sdk/deliveries/${encodeURIComponent(deliveryId)}/click`,
      });
    },

    async saveDeepLinks(
      links: readonly DeepLink[],
    ): Promise<readonly DeepLink[]> {
      const data = await http.request({
        method: "POST",
        path: "/v1/sdk/deep-links",
        body: {
          links: links.map((link) => ({
            path: link.path,
            label: link.label,
          })),
        },
      });

      return parseDeepLinks(data);
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

const emptyDeliveryConfig: DeliveryConfig = {
  environment: null,
  app: null,
  android: null,
  ios: null,
  web: null,
};

function parseDeliveryConfig(data: unknown): DeliveryConfig {
  // An app with no configured platform used to be an empty PHP list.
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return emptyDeliveryConfig;
    }

    throw invalidClientConfig();
  }

  if (!isRecord(data)) {
    throw invalidClientConfig();
  }

  return {
    environment: clientEnvironment(data.environment),
    app: parseClientApp(data.app),
    android: recordOrNull(data.android),
    ios: recordOrNull(data.ios),
    web: recordOrNull(data.web),
  };
}

function clientEnvironment(value: unknown): DeliveryConfig["environment"] {
  if (value === "development" || value === "production") {
    return value;
  }

  return null;
}

function parseClientApp(value: unknown): DeliveryConfig["app"] {
  if (!isRecord(value)) {
    return null;
  }

  return {
    name: textOrNull(value.name),
    description: textOrNull(value.description),
    icon: textOrNull(value.icon),
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function invalidClientConfig(): NotifiableError {
  return new NotifiableError({
    code: "network",
    message: "The client configuration response was invalid.",
  });
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

function parseDeepLinks(data: unknown): readonly DeepLink[] {
  if (!isRecord(data) || !Array.isArray(data.links)) {
    throw new NotifiableError({
      code: "network",
      message: "The deep link response was invalid.",
    });
  }

  const links: DeepLink[] = [];

  for (const entry of data.links) {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      typeof entry.label !== "string" ||
      entry.label.length === 0
    ) {
      continue;
    }

    links.push({ path: entry.path, label: entry.label });
  }

  return links;
}

function inboxPath(subscriberId: string, query?: InboxQuery): string {
  const path = `/v1/sdk/subscribers/${encodeURIComponent(subscriberId)}/notifications`;
  const params: string[] = [];

  if (query?.page !== undefined) {
    params.push(`page=${query.page}`);
  }

  if (query?.opened !== undefined) {
    params.push(`opened=${query.opened ? "true" : "false"}`);
  }

  return params.length === 0 ? path : `${path}?${params.join("&")}`;
}

function parseInboxPage(data: unknown): InboxPage {
  if (
    !isRecord(data) ||
    !Array.isArray(data.notifications) ||
    typeof data.page !== "number" ||
    typeof data.per_page !== "number" ||
    typeof data.total !== "number"
  ) {
    throw new NotifiableError({
      code: "network",
      message: "The notification list was invalid.",
    });
  }

  const notifications: SubscriberNotification[] = [];

  for (const entry of data.notifications) {
    const notification = parseNotification(entry);

    if (notification !== null) {
      notifications.push(notification);
    }
  }

  return {
    notifications,
    page: data.page,
    perPage: data.per_page,
    total: data.total,
  };
}

function parseNotification(value: unknown): SubscriberNotification | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    typeof value.opened !== "boolean" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    body: value.body,
    url: textOrNull(value.url),
    imageUrl: textOrNull(value.image_url),
    data: recordOrNull(value.data),
    alert: typeof value.alert === "boolean" ? value.alert : true,
    status: textOrNull(value.status),
    opened: value.opened,
    openedAt: textOrNull(value.opened_at),
    createdAt: value.created_at,
    deliveryId: textOrNull(value.delivery_id),
  };
}
