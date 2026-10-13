import { describe, expect, it } from "vitest";
import {
  devNotificationFreshMs,
  notificationDeliveryId,
  selectFreshNotifications,
  type SubscriberNotification,
} from "./inbox";

const now = Date.parse("2026-10-13T17:29:20.897Z");

function notification(
  patch: Partial<SubscriberNotification> = {},
): SubscriberNotification {
  return {
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
    createdAt: new Date(now - 1000).toISOString(),
    deliveryId: null,
    ...patch,
  };
}

describe("notificationDeliveryId", () => {
  it("uses the delivery id, then the opt value on the url", () => {
    expect(
      notificationDeliveryId(notification({ deliveryId: "delivery_1" })),
    ).toBe("delivery_1");
    expect(
      notificationDeliveryId(notification({ url: "/about?opt=delivery_2" })),
    ).toBe("delivery_2");
    expect(notificationDeliveryId(notification({ url: "/about" }))).toBeNull();
  });
});

describe("selectFreshNotifications", () => {
  it("keeps an unread alert created inside the freshness window", () => {
    expect(selectFreshNotifications([notification()], now, new Set())).toEqual([
      notification(),
    ]);
  });

  it("drops opened, silent, seen, and older notifications", () => {
    const items = [
      notification({ id: "opened", opened: true }),
      notification({ id: "silent", alert: false }),
      notification({ id: "seen" }),
      notification({
        id: "old",
        createdAt: new Date(now - devNotificationFreshMs - 1).toISOString(),
      }),
    ];

    expect(selectFreshNotifications(items, now, new Set(["seen"]))).toEqual([]);
  });
});
