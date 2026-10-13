import { act, createElement } from "react";
// Node tests have no DOM. react-test-renderer is deprecated, and it is still
// the renderer that can mount this hook without a browser document.
import { create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { NotifiableClient, NotifiableSnapshot } from "../client/types";
import { NotifiableError } from "../domain/errors";
import { NotifiableProvider } from "./provider";
import { useNotifiable } from "./use-notifiable";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe(): null {
  useNotifiable();
  return null;
}

function renderError(error: unknown): unknown {
  if (error instanceof AggregateError) {
    return error.errors[0];
  }

  return error;
}

describe("useNotifiable", () => {
  it("requires the provider", () => {
    try {
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        create(createElement(Probe));
      });
      expect.fail("expected missing_provider");
    } catch (error) {
      expect(renderError(error)).toBeInstanceOf(NotifiableError);
      expect(renderError(error)).toMatchObject({ code: "missing_provider" });
    }
  });

  it("reads config from the provider and starts the client", () => {
    let publicKey = "";

    function ReadConfig(): null {
      publicKey = useNotifiable().config.publicKey;
      return null;
    }

    const snapshot: NotifiableSnapshot = {
      ready: false,
      permission: "not_determined",
      subscriber: null,
      clientConfig: null,
      devIndicator: null,
      deepLinks: null,
      error: null,
    };
    const start = vi.fn(() => Promise.resolve());
    const client: NotifiableClient = {
      config: {
        publicKey: "ntf_pub_test",
        environment: "local",
        baseUrl: "http://127.0.0.1:8000/api",
      },
      start,
      requestPermission: vi.fn(() => Promise.resolve("denied" as const)),
      identify: vi.fn(),
      setDevIndicator: vi.fn(() => Promise.resolve()),
      listNotifications: vi.fn(() =>
        Promise.resolve({
          notifications: [],
          page: 1,
          perPage: 20,
          total: 0,
        }),
      ),
      inbox: vi.fn(() =>
        Promise.resolve({
          notifications: [],
          page: 1,
          perPage: 20,
          total: 0,
        }),
      ),
      notification: vi.fn(),
      openNotification: vi.fn(() => Promise.resolve()),
      openStoredNotification: vi.fn(() => Promise.resolve()),
      clickDelivery: vi.fn(() => Promise.resolve()),
      track: vi.fn(() =>
        Promise.resolve({
          id: "evt_1",
          name: "order.shipped",
          subscriberId: "sub_1",
        }),
      ),
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
    };

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      create(
        createElement(NotifiableProvider, {
          client,
          children: createElement(ReadConfig),
        }),
      );
    });

    expect(publicKey).toBe("ntf_pub_test");
    expect(start).toHaveBeenCalledOnce();
  });
});
