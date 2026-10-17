import { act, createElement } from "react";
// Node tests have no DOM. react-test-renderer is deprecated, and it is still
// the renderer that can mount this component without a browser document.
import { create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { NotifiableClient, NotifiableSnapshot } from "../client/types";
import type { PermissionStatus, Subscriber } from "../domain/subscriber";
import { NotifiableContext } from "./context";
import { DevToasts } from "./dev-toasts";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function subscriber(permission: PermissionStatus): Subscriber {
  return {
    id: "sub_1",
    environment: "development",
    platform: "ios",
    permission,
    sdk: "react-native",
    provider: null,
    deviceId: "device",
    externalId: null,
    anonymousId: null,
    promptPermission: false,
  };
}

function snapshot(permission: PermissionStatus): NotifiableSnapshot {
  return {
    ready: true,
    permission,
    subscriber: subscriber(permission),
    clientConfig: {
      environment: "development",
      app: { name: "Example", description: null, icon: null },
      android: null,
      ios: null,
      web: null,
    },
    devIndicator: "enabled",
    diagnostics: "enabled",
    deepLinks: null,
    error: null,
  };
}

function mount(permission: PermissionStatus) {
  let current = snapshot(permission);
  const listeners = new Set<() => void>();
  const listNotifications = vi.fn(() =>
    Promise.resolve({
      notifications: [],
      page: 1,
      perPage: 20,
      total: 0,
    }),
  );
  const client: NotifiableClient = {
    config: { publicKey: "ntf_pub_test" },
    start: vi.fn(() => Promise.resolve()),
    requestPermission: vi.fn(() => Promise.resolve(permission)),
    identify: vi.fn(),
    setDevIndicator: vi.fn(() => Promise.resolve()),
    setDiagnostics: vi.fn(() => Promise.resolve()),
    listNotifications,
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
    track: vi.fn(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => current,
  };

  let renderer: ReturnType<typeof create> | undefined;

  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    renderer = create(
      createElement(
        NotifiableContext.Provider,
        { value: client },
        createElement(DevToasts),
      ),
    );
  });

  return {
    listNotifications,
    unmount: () => {
      act(() => {
        renderer?.unmount();
      });
    },
    setPermission: (next: PermissionStatus) => {
      current = snapshot(next);
      act(() => {
        for (const listener of listeners) {
          listener();
        }
      });
    },
  };
}

describe("DevToasts", () => {
  it("waits to poll until permission is granted", () => {
    const denied = mount("denied");

    expect(denied.listNotifications).not.toHaveBeenCalled();
    denied.unmount();

    const pending = mount("not_determined");

    expect(pending.listNotifications).not.toHaveBeenCalled();
    pending.setPermission("granted");
    expect(pending.listNotifications).toHaveBeenCalledWith("sub_1", {
      page: 1,
      opened: false,
    });
    pending.unmount();
  });

  it("stops polling when permission is no longer granted", async () => {
    vi.useFakeTimers();
    const granted = mount("granted");

    expect(granted.listNotifications).toHaveBeenCalledOnce();
    granted.listNotifications.mockClear();
    granted.setPermission("denied");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(granted.listNotifications).not.toHaveBeenCalled();
    granted.unmount();
    vi.useRealTimers();
  });
});
