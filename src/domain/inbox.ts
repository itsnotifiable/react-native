export interface SubscriberNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
  readonly imageUrl: string | null;
  readonly data: Readonly<Record<string, unknown>> | null;
  readonly alert: boolean;
  readonly status: string | null;
  readonly opened: boolean;
  readonly openedAt: string | null;
  readonly createdAt: string;
  readonly deliveryId: string | null;
}

export interface InboxQuery {
  readonly page?: number;
  readonly opened?: boolean;
}

export interface InboxPage {
  readonly notifications: readonly SubscriberNotification[];
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
}

export function notificationDeliveryId(
  notification: SubscriberNotification,
): string | null {
  if (notification.deliveryId !== null && notification.deliveryId.length > 0) {
    return notification.deliveryId;
  }

  const url = notification.url;

  if (url === null) {
    return null;
  }

  try {
    const opt = new URL(url, "https://notifiable.invalid").searchParams.get(
      "opt",
    );

    return opt !== null && opt.length > 0 ? opt : null;
  } catch {
    return null;
  }
}

export const devNotificationFreshMs = 8000;

const clockSkewMs = 2000;

export function selectFreshNotifications(
  notifications: readonly SubscriberNotification[],
  nowMs: number,
  seen: ReadonlySet<string>,
): readonly SubscriberNotification[] {
  return notifications.filter((notification) => {
    if (
      notification.opened ||
      !notification.alert ||
      seen.has(notification.id)
    ) {
      return false;
    }

    const created = Date.parse(notification.createdAt);

    if (Number.isNaN(created)) {
      return false;
    }

    const age = nowMs - created;

    return age >= -clockSkewMs && age <= devNotificationFreshMs;
  });
}
