export interface SubscriberNotification {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
  readonly imageUrl: string | null;
  readonly alert: boolean;
  readonly opened: boolean;
  readonly createdAt: string;
  readonly deliveryId: string | null;
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
