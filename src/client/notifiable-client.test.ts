import { describe, expect, it, vi } from "vitest";
import { NotifiableError } from "../domain/errors";
import { createMemoryStorage } from "../internal/memory-storage";
import { sessionKey } from "../internal/session";
import type { KeyValueStore } from "../domain/storage";
import type {
  DeliveryConfig,
  IdentifyInput,
  Subscriber,
  SubscriberIdentity,
  SubscriberWrite,
} from "../domain/subscriber";
import type { DiagnosticCrash } from "../domain/diagnostic";
import type { DeepLink } from "../domain/deep-link";
import type { InboxQuery } from "../domain/inbox";
import type { DevicePort, PushPort } from "../platform/types";
import type { SdkApi } from "../transport/sdk-api";
import { NotifiableClientImpl } from "./notifiable-client";

const device: DevicePort = {
  getProfile: () =>
    Promise.resolve({
      platform: "ios",
      osVersion: "18.0",
      locale: "en-US",
      timezone: "Africa/Casablanca",
      model: "iPhone17,1",
      manufacturer: "Apple",
      appVersion: "1.0",
      ip: "192.168.1.20",
    }),
};

function subscriberFrom(write: SubscriberWrite): Subscriber {
  return {
    id: "sub_1",
    environment: "development",
    platform: write.platform,
    permission: write.permission,
    sdk: "react-native",
    provider: write.provider ?? null,
    deviceId: write.deviceId,
    externalId: null,
    anonymousId: write.anonymousId ?? null,
    promptPermission: false,
  };
}

function createApi(): SdkApi & {
  readonly saves: SubscriberWrite[];
  readonly updates: Array<{ id: string; identity: SubscriberIdentity }>;
  readonly inbox: string[];
  readonly deepLinks: DeepLink[][];
  readonly diagnostics: DiagnosticCrash[][];
} {
  const saves: SubscriberWrite[] = [];
  const updates: Array<{ id: string; identity: SubscriberIdentity }> = [];
  const inbox: string[] = [];
  const deepLinks: DeepLink[][] = [];
  const diagnostics: DiagnosticCrash[][] = [];

  return {
    saves,
    updates,
    inbox,
    deepLinks,
    diagnostics,
    getClientConfig: vi.fn(() =>
      Promise.resolve({
        environment: null,
        app: null,
        android: null,
        ios: null,
        web: null,
      }),
    ),
    saveSubscriber: vi.fn((write: SubscriberWrite) => {
      saves.push(write);
      return Promise.resolve(subscriberFrom(write));
    }),
    listNotifications: vi.fn((subscriberId: string, query?: InboxQuery) => {
      inbox.push(
        query === undefined
          ? `list ${subscriberId}`
          : `list ${subscriberId} page=${query.page ?? ""} opened=${String(query.opened)}`,
      );
      return Promise.resolve({
        notifications: [],
        page: query?.page ?? 1,
        perPage: 20,
        total: 0,
      });
    }),
    getNotification: vi.fn((subscriberId: string, notificationId: string) => {
      inbox.push(`get ${subscriberId} ${notificationId}`);
      return Promise.resolve({
        id: notificationId,
        title: "Hello",
        body: "There",
        url: null,
        imageUrl: null,
        data: null,
        alert: true,
        status: "delivered",
        opened: false,
        openedAt: null,
        createdAt: "2026-10-13T17:29:20.897Z",
        deliveryId: null,
      });
    }),
    openNotification: vi.fn((subscriberId: string, notificationId: string) => {
      inbox.push(`open ${subscriberId} ${notificationId}`);
      return Promise.resolve();
    }),
    clickDelivery: vi.fn((deliveryId: string) => {
      inbox.push(`click ${deliveryId}`);
      return Promise.resolve();
    }),
    trackEvent: vi.fn(
      (
        subscriberId: string,
        name: string,
        properties?: Readonly<Record<string, string | number | boolean | null>>,
      ) => {
        inbox.push(
          `track ${subscriberId} ${name} ${JSON.stringify(properties ?? null)}`,
        );
        return Promise.resolve({
          id: "evt_1",
          name,
          subscriberId,
        });
      },
    ),
    reportDiagnostics: vi.fn((items: readonly DiagnosticCrash[]) => {
      diagnostics.push([...items]);
      return Promise.resolve(items.length);
    }),
    saveDeepLinks: vi.fn((links: readonly DeepLink[]) => {
      const saved = links.map((link) => ({
        path: link.path,
        label: link.label,
      }));
      deepLinks.push(saved);
      return Promise.resolve(saved);
    }),
    updateSubscriber: vi.fn((id: string, identity: SubscriberIdentity) => {
      updates.push({ id, identity });
      return Promise.resolve({
        ...subscriberFrom({
          deviceId: "device",
          platform: "ios",
          permission: "denied",
        }),
        id,
        externalId: identity.externalId ?? null,
        anonymousId: identity.anonymousId ?? null,
      });
    }),
  };
}

function createClient(
  storage: KeyValueStore,
  push?: PushPort,
  api: SdkApi = createApi(),
  deepLinks?: readonly DeepLink[],
): NotifiableClientImpl {
  return new NotifiableClientImpl(
    {
      publicKey: "ntf_pub_test",
      ...(push !== undefined ? { push } : {}),
      ...(deepLinks !== undefined ? { deepLinks } : {}),
      storage,
      device,
    },
    api,
    device,
    storage,
  );
}

const shopConfig: DeliveryConfig = {
  environment: "development",
  app: {
    name: "Shop",
    description: "Order alerts",
    icon: "https://cdn.example/mark.png",
  },
  android: null,
  ios: { bundle_id: "com.example.app" },
  web: null,
};

describe("subscriber registration", () => {
  it("remembers whether the development mark is shown", async () => {
    const storage = createMemoryStorage();
    const client = createClient(storage);

    await client.start();
    expect(client.getSnapshot().devIndicator).toBeNull();

    await client.setDevIndicator(true);
    expect(client.getSnapshot().devIndicator).toBe("enabled");

    const again = createClient(storage);
    await again.start();
    expect(again.getSnapshot().devIndicator).toBe("enabled");
  });

  it("stores the client configuration before the subscriber save", async () => {
    const api = createApi();
    const failing: SdkApi = {
      ...api,
      getClientConfig: () => Promise.resolve(shopConfig),
      saveSubscriber: () => Promise.reject(new Error("offline")),
    };
    const client = createClient(createMemoryStorage(), undefined, failing);

    await expect(client.start()).rejects.toMatchObject({
      code: "network",
      message: "offline",
    });
    expect(client.getSnapshot().clientConfig).toEqual(shopConfig);
    expect(client.getSnapshot().ready).toBe(false);
  });

  it("registers when permission is denied and omits the token", async () => {
    const api = createApi();
    const push: PushPort = {
      provider: "apns",
      getPermissionStatus: () => Promise.resolve("denied"),
      requestPermission: () => Promise.resolve("denied"),
      getToken: () => Promise.resolve("should-not-send"),
    };
    const client = createClient(createMemoryStorage(), push, api);

    await client.start();

    expect(client.getSnapshot()).toMatchObject({
      ready: true,
      permission: "denied",
      error: null,
    });
    expect(api.saves[0]).toMatchObject({
      platform: "ios",
      permission: "denied",
      osVersion: "18.0",
      locale: "en-US",
      timezone: "Africa/Casablanca",
      model: "iPhone17,1",
      manufacturer: "Apple",
      appVersion: "1.0",
      ip: "192.168.1.20",
      language: "en",
      countryCode: "US",
      sdkVersion: "0.0.0",
    });
    expect(api.saves[0]?.token).toBeUndefined();
    expect(api.saves[0]?.provider).toBeUndefined();
    expect(api.saves[0]?.anonymousId).toEqual(expect.any(String));
  });

  it("sends the token when permission is granted", async () => {
    const api = createApi();
    const push: PushPort = {
      provider: "fcm",
      getPermissionStatus: () => Promise.resolve("granted"),
      requestPermission: () => Promise.resolve("granted"),
      getToken: () => Promise.resolve("device-token"),
    };
    const client = createClient(createMemoryStorage(), push, api);

    await client.start();

    expect(api.saves[0]).toMatchObject({
      permission: "granted",
      provider: "fcm",
      token: "device-token",
    });
    expect(client.getSnapshot().subscriber?.provider).toBe("fcm");
  });

  it("reuses the device id and does not send identity again", async () => {
    const storage = createMemoryStorage();
    const firstApi = createApi();
    const first = createClient(storage, undefined, firstApi);
    await first.start();
    const deviceId = firstApi.saves[0]?.deviceId;

    const secondApi = createApi();
    const second = createClient(storage, undefined, secondApi);
    await second.start();

    expect(secondApi.saves[0]?.deviceId).toBe(deviceId);
    expect(secondApi.saves[0]?.anonymousId).toBeUndefined();
    expect(second.getSnapshot().subscriber?.id).toBe("sub_1");
  });

  it("asks for permission again when the subscriber requests a prompt", async () => {
    const api = createApi();
    const saves: SubscriberWrite[] = [];
    const prompting: SdkApi = {
      ...api,
      saveSubscriber: (write: SubscriberWrite) => {
        saves.push(write);
        return Promise.resolve({
          ...subscriberFrom(write),
          promptPermission: write.prompted !== true,
        });
      },
    };
    const requestPermission = vi.fn(() => Promise.resolve("denied" as const));
    const push: PushPort = {
      provider: "apns",
      getPermissionStatus: () => Promise.resolve("denied"),
      requestPermission,
      getToken: () => Promise.resolve(null),
    };
    const client = createClient(createMemoryStorage(), push, prompting);

    await client.start();

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(saves).toHaveLength(2);
    expect(saves[1]).toMatchObject({
      permission: "denied",
      prompted: true,
    });
    expect(client.getSnapshot().subscriber?.promptPermission).toBe(false);
  });

  it("updates permission after a denial without dropping the subscriber", async () => {
    const api = createApi();
    const push: PushPort = {
      provider: "apns",
      getPermissionStatus: () => Promise.resolve("not_determined"),
      requestPermission: () => Promise.resolve("denied"),
      getToken: () => Promise.resolve(null),
    };
    const client = createClient(createMemoryStorage(), push, api);

    await client.requestPermission();

    expect(api.saves).toHaveLength(2);
    expect(api.saves[1]).toMatchObject({
      permission: "denied",
      prompted: true,
    });
    expect(api.saves[1]?.anonymousId).toBeUndefined();
    expect(api.saves[1]?.token).toBeUndefined();
    expect(client.getSnapshot().permission).toBe("denied");
  });

  it("refuses a granted permission that has no token", async () => {
    const api = createApi();
    const push: PushPort = {
      provider: "fcm",
      requestPermission: () => Promise.resolve("granted"),
      getToken: () => Promise.resolve("  "),
    };
    const client = createClient(createMemoryStorage(), push, api);

    await expect(client.requestPermission()).rejects.toBeInstanceOf(
      NotifiableError,
    );
    await expect(client.requestPermission()).rejects.toMatchObject({
      code: "missing_token",
    });
    expect(api.saves).toHaveLength(1);
    expect(client.getSnapshot().error?.code).toBe("missing_token");
  });

  it("saves not_determined when a granted permission has no token", async () => {
    const api = createApi();
    const push: PushPort = {
      provider: "expo",
      allowMissingToken: true,
      getPermissionStatus: () => Promise.resolve("granted"),
      requestPermission: () => Promise.resolve("granted"),
      getToken: () => Promise.resolve(null),
    };
    const client = createClient(createMemoryStorage(), push, api);

    await client.start();

    expect(client.getSnapshot()).toMatchObject({
      ready: true,
      permission: "not_determined",
      error: null,
    });
    expect(api.saves[0]?.permission).toBe("not_determined");
    expect(api.saves[0]?.token).toBeUndefined();
    expect(api.saves[0]?.provider).toBeUndefined();
  });

  it("identifies an anonymous subscriber by email", async () => {
    const api = createApi();
    const storage = createMemoryStorage();
    const client = createClient(storage, undefined, api);

    const identified = await client.identify({
      email: " ada@example.com ",
      externalId: "user_123",
      firstName: "Ada",
    } satisfies IdentifyInput);

    expect(api.updates[0]).toEqual({
      id: "sub_1",
      identity: {
        email: "ada@example.com",
        externalId: "user_123",
        firstName: "Ada",
        anonymousId: null,
      },
    });
    expect(identified.anonymousId).toBeNull();

    const stored = await storage.getItem(sessionKey("ntf_pub_test"));
    expect(JSON.parse(stored ?? "")).toMatchObject({
      subscriberId: "sub_1",
      anonymousId: null,
    });
  });

  it("lists and records notifications without the registration queue", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, api);

    await expect(client.listNotifications("sub_1")).resolves.toMatchObject({
      notifications: [],
      page: 1,
    });
    await client.openNotification("sub_1", "note_1");
    await client.clickDelivery("delivery_1");

    expect(api.inbox).toEqual([
      "list sub_1",
      "open sub_1 note_1",
      "click delivery_1",
    ]);
    expect(api.saves).toEqual([]);
  });

  it("saves the app deep links after the subscriber connects", async () => {
    const api = createApi();
    const links = [
      { path: "/about", label: "About Notifiable" },
      { path: "/inbox", label: "Inbox" },
    ];
    const client = createClient(createMemoryStorage(), undefined, api, links);

    await client.start();

    expect(api.deepLinks).toEqual([links]);
    expect(client.getSnapshot().deepLinks).toEqual(links);
  });

  it("lists the connected subscriber inbox without an id argument", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, api);

    await client.start();
    await expect(
      client.inbox({ page: 2, opened: false }),
    ).resolves.toMatchObject({
      page: 2,
      perPage: 20,
      total: 0,
    });
    await expect(client.notification("note_1")).resolves.toMatchObject({
      id: "note_1",
    });
    await client.openStoredNotification("note_1");

    expect(api.inbox).toEqual([
      "list sub_1 page=2 opened=false",
      "get sub_1 note_1",
      "open sub_1 note_1",
    ]);
  });

  it("records an event for the connected subscriber", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, api);

    await client.start();
    await expect(
      client.track("order.shipped", { order: "1001" }),
    ).resolves.toEqual({
      id: "evt_1",
      name: "order.shipped",
      subscriberId: "sub_1",
    });
    expect(api.inbox).toEqual(['track sub_1 order.shipped {"order":"1001"}']);
  });

  it("reports a development connect failure once", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, {
      ...api,
      getClientConfig: () => Promise.resolve(shopConfig),
      saveSubscriber: () =>
        Promise.reject(
          new NotifiableError({ code: "network", message: "offline" }),
        ),
    });

    await expect(client.start()).rejects.toMatchObject({
      code: "network",
      message: "offline",
    });
    await expect(client.start()).rejects.toMatchObject({
      code: "network",
      message: "offline",
    });
    await vi.waitFor(() => {
      expect(api.diagnostics).toHaveLength(1);
    });
    expect(api.diagnostics[0]?.[0]).toMatchObject({
      kind: "crash",
      sdk: "react-native",
      sdkVersion: "0.0.0",
      platform: "ios",
      error: {
        type: "NotifiableError.network",
        message: "offline",
      },
    });
    expect(api.diagnostics[0]?.[0]?.subscriberId).toBeUndefined();
    expect(api.diagnostics[0]?.[0]?.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("does not report when diagnostics are disabled", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, {
      ...api,
      getClientConfig: () => Promise.resolve(shopConfig),
      saveSubscriber: () =>
        Promise.reject(
          new NotifiableError({ code: "network", message: "offline" }),
        ),
    });

    await client.setDiagnostics(false);
    await expect(client.start()).rejects.toMatchObject({ code: "network" });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(api.diagnostics).toEqual([]);
  });

  it("does not report a production connect failure", async () => {
    const api = createApi();
    const client = createClient(createMemoryStorage(), undefined, {
      ...api,
      getClientConfig: () =>
        Promise.resolve({ ...shopConfig, environment: "production" }),
      saveSubscriber: () =>
        Promise.reject(
          new NotifiableError({ code: "network", message: "offline" }),
        ),
    });

    await expect(client.start()).rejects.toMatchObject({ code: "network" });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(api.diagnostics).toEqual([]);
  });
});
