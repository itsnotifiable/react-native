import { describe, expect, it, vi } from "vitest";
import { NotifiableError } from "../domain/errors";
import { createMemoryStorage } from "../internal/memory-storage";
import { sessionKey } from "../internal/session";
import type { KeyValueStore } from "../domain/storage";
import type {
  IdentifyInput,
  Subscriber,
  SubscriberIdentity,
  SubscriberWrite,
} from "../domain/subscriber";
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
} {
  const saves: SubscriberWrite[] = [];
  const updates: Array<{ id: string; identity: SubscriberIdentity }> = [];

  return {
    saves,
    updates,
    getClientConfig: vi.fn(() =>
      Promise.resolve({ android: null, ios: null, web: null }),
    ),
    saveSubscriber: vi.fn((write: SubscriberWrite) => {
      saves.push(write);
      return Promise.resolve(subscriberFrom(write));
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
): NotifiableClientImpl {
  return new NotifiableClientImpl(
    {
      publicKey: "ntf_pub_test",
      environment: "local",
      baseUrl: "http://127.0.0.1:8000/api",
      ...(push !== undefined ? { push } : {}),
      storage,
      device,
    },
    api,
    device,
    storage,
  );
}

describe("subscriber registration", () => {
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
});
