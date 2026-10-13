import { describe, expect, it } from "vitest";
import { NotifiableError } from "../domain/errors";
import type { FetchLike, FetchResponse } from "./types";
import { createHttpClient } from "./http-client";
import { createSdkApi } from "./sdk-api";

const subscriber = {
  id: "sub_1",
  environment: "development",
  platform: "ios",
  permission: "denied",
  sdk: "react-native",
  provider: null,
  device_id: "device_1",
  external_id: null,
  anonymous_id: "anon_1",
  prompt_permission: false,
};

function envelope(data: unknown, code = "SUBSCRIBER_SAVED"): unknown {
  return {
    request_id: "req_01JQX8Y7M4N2F6K9P3R5T1V8CZ",
    status: "success",
    code,
    message: "ok",
    timestamp: "2026-01-01T00:00:00Z",
    data,
  };
}

function jsonResponse(status: number, body: unknown): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe("sdk api", () => {
  it("sends the public key and saves a subscriber", async () => {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, init });
      const path = url.endsWith("/client-config")
        ? envelope({ android: { status: "ready" } }, "CLIENT_CONFIG")
        : envelope(subscriber);
      return Promise.resolve(jsonResponse(200, path));
    };
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api/",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await api.getClientConfig();
    const saved = await api.saveSubscriber({
      deviceId: "device_1",
      platform: "ios",
      permission: "denied",
      anonymousId: "anon_1",
    });

    expect(saved.id).toBe("sub_1");
    expect(saved.permission).toBe("denied");
    expect(calls.map((call) => call.url)).toEqual([
      "http://127.0.0.1:8000/api/v1/sdk/client-config",
      "http://127.0.0.1:8000/api/v1/sdk/subscribers",
    ]);
    expect(calls[0]?.init?.headers).toMatchObject({
      Accept: "application/json",
      "X-Notifiable-Key": "ntf_pub_test",
    });
    expect(calls[1]?.init?.method).toBe("POST");
    expect(JSON.parse(calls[1]?.init?.body ?? "")).toEqual({
      device_id: "device_1",
      platform: "ios",
      sdk: "react-native",
      permission: "denied",
      anonymous_id: "anon_1",
    });
  });

  it("patches identity and maps an invalid public key", async () => {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, init });

      if (init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse(200, envelope({ ...subscriber, anonymous_id: null })),
        );
      }

      return Promise.resolve(
        jsonResponse(401, {
          status: "error",
          code: "INVALID_PUBLIC_KEY",
          message: "The public key is invalid.",
          error: { type: "authentication_error", details: null },
        }),
      );
    };
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(api.getClientConfig()).rejects.toMatchObject({
      code: "invalid_public_key",
    });

    const updated = await api.updateSubscriber("sub_1", {
      email: "ada@example.com",
      externalId: "user_123",
      anonymousId: null,
    });

    expect(updated.anonymousId).toBeNull();
    expect(calls[1]?.url).toBe(
      "http://127.0.0.1:8000/api/v1/sdk/subscribers/sub_1",
    );
    expect(calls[1]?.init?.headers).toMatchObject({
      "X-Notifiable-Key": "ntf_pub_test",
    });
    expect(JSON.parse(calls[1]?.init?.body ?? "")).toEqual({
      email: "ada@example.com",
      external_id: "user_123",
      anonymous_id: null,
    });
  });

  it("maps validation details", async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(422, {
          status: "error",
          code: "VALIDATION_FAILED",
          message: "The request contains invalid fields.",
          error: {
            type: "validation_error",
            details: [
              {
                field: "email",
                code: "INVALID_EMAIL",
                message: "Invalid email.",
              },
            ],
          },
        }),
      );
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(
      api.updateSubscriber("sub_1", { email: "not-an-email" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "validation_failed",
        message: "Invalid email.",
      }),
    );
  });

  it("accepts an empty client configuration list", async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(jsonResponse(200, envelope([], "CLIENT_CONFIG")));
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(api.getClientConfig()).resolves.toEqual({
      environment: null,
      app: null,
      android: null,
      ios: null,
      web: null,
    });
  });

  it("reads the app from client configuration", async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse(
          200,
          envelope(
            {
              environment: "development",
              app: {
                name: "Shop",
                description: "Order alerts",
                icon: "https://cdn.example/mark.png",
              },
              ios: { bundle_id: "com.example.app" },
            },
            "CLIENT_CONFIG",
          ),
        ),
      );
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(api.getClientConfig()).resolves.toEqual({
      environment: "development",
      app: {
        name: "Shop",
        description: "Order alerts",
        icon: "https://cdn.example/mark.png",
      },
      android: null,
      ios: { bundle_id: "com.example.app" },
      web: null,
    });
  });

  it("lists unread notifications and records an open and a click", async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, method: init?.method });

      if (init?.method === "GET") {
        return Promise.resolve(
          jsonResponse(
            200,
            envelope(
              {
                notifications: [
                  {
                    id: "note_1",
                    title: "Your notification title",
                    body: "Your message...",
                    url: null,
                    image_url: null,
                    data: [],
                    alert: true,
                    status: "delivered",
                    opened: false,
                    opened_at: null,
                    created_at: "2026-10-13T17:29:20.897Z",
                    delivery_id: "delivery_1",
                  },
                  { id: 4 },
                ],
                page: 1,
                per_page: 5,
                total: 1,
              },
              "NOTIFICATIONS_LISTED",
            ),
          ),
        );
      }

      return Promise.resolve(
        jsonResponse(200, envelope({ id: "recorded" }, "NOTIFICATION_OPENED")),
      );
    };
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(
      api.listNotifications("sub 1", { page: 1, opened: false }),
    ).resolves.toEqual({
      notifications: [
        {
          id: "note_1",
          title: "Your notification title",
          body: "Your message...",
          url: null,
          imageUrl: null,
          data: null,
          alert: true,
          status: "delivered",
          opened: false,
          openedAt: null,
          createdAt: "2026-10-13T17:29:20.897Z",
          deliveryId: "delivery_1",
        },
      ],
      page: 1,
      perPage: 5,
      total: 1,
    });
    await api.openNotification("sub 1", "note 1");
    await api.clickDelivery("delivery 1");

    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "POST"]);
    expect(calls[0]?.url).toBe(
      "http://127.0.0.1:8000/api/v1/sdk/subscribers/sub%201/notifications?page=1&opened=false",
    );
    expect(calls[1]?.url).toBe(
      "http://127.0.0.1:8000/api/v1/sdk/subscribers/sub%201/notifications/note%201/open",
    );
    expect(calls[2]?.url).toBe(
      "http://127.0.0.1:8000/api/v1/sdk/deliveries/delivery%201/click",
    );
  });

  it("saves deep links for the public key", async () => {
    let request: {
      url: string;
      method: string | undefined;
      body: string | undefined;
    } = { url: "", method: undefined, body: undefined };
    const fetchImpl: FetchLike = (url, init) => {
      request = { url, method: init?.method, body: init?.body };
      return Promise.resolve(
        jsonResponse(
          200,
          envelope(
            {
              links: [
                { path: "/about", label: "About Notifiable" },
                { path: "", label: "Skip" },
              ],
            },
            "DEEP_LINKS_SAVED",
          ),
        ),
      );
    };
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    await expect(
      api.saveDeepLinks([{ path: "/about", label: "About Notifiable" }]),
    ).resolves.toEqual([{ path: "/about", label: "About Notifiable" }]);
    expect(request).toEqual({
      url: "http://127.0.0.1:8000/api/v1/sdk/deep-links",
      method: "POST",
      body: JSON.stringify({
        links: [{ path: "/about", label: "About Notifiable" }],
      }),
    });
  });

  it("reports network failures", async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error("offline"));
    const api = createSdkApi(
      createHttpClient({
        baseUrl: "http://127.0.0.1:8000/api",
        publicKey: "ntf_pub_test",
        fetch: fetchImpl,
      }),
    );

    try {
      await api.getClientConfig();
      expect.fail("expected a network error");
    } catch (error) {
      expect(error).toBeInstanceOf(NotifiableError);
      expect(error).toMatchObject({ code: "network", message: "offline" });
    }
  });
});
