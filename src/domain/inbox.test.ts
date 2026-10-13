import { describe, expect, it } from "vitest";
import {
  devNotificationFreshMs,
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
    alert: true,
    opened: false,
    createdAt: new Date(now - 1000).toISOString(),
    deliveryId: null,
    ...patch,
  };
}

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
