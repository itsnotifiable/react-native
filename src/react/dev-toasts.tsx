import { useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NotifiableClient } from "../client/types";
import { NotifiableError } from "../domain/errors";
import {
  notificationDeliveryId,
  selectFreshNotifications,
  type SubscriberNotification,
} from "../domain/inbox";
import { NotifiableContext } from "./context";
import { useNotifiable } from "./use-notifiable";

const pollMs = 5000;
const maxPollMs = 30000;
const visibleMs = 4500;
const seenLimit = 50;
const markIcon = "https://notifiable.sh/favicon.png";

interface QueuedToast {
  readonly notification: SubscriberNotification;
  readonly subscriberId: string;
}

export function DevToasts(): React.JSX.Element | null {
  const client = useContext(NotifiableContext);
  const notifiable = useNotifiable();
  const subscriberId = notifiable.subscriber?.id ?? null;
  const permission = notifiable.permission;
  const icon = toastIcon(notifiable.clientConfig?.app?.icon);
  const queueRef = useRef<QueuedToast[]>([]);
  const currentRef = useRef<QueuedToast | null>(null);
  const presentRef = useRef<(items: readonly SubscriberNotification[]) => void>(
    () => undefined,
  );
  const [current, setCurrent] = useState<QueuedToast | null>(null);

  presentRef.current = (items): void => {
    if (subscriberId === null) {
      return;
    }

    queueRef.current.push(
      ...items.map((notification) => ({ notification, subscriberId })),
    );

    if (currentRef.current === null) {
      const next = queueRef.current.shift() ?? null;
      currentRef.current = next;
      setCurrent(next);
    }
  };

  useEffect(() => {
    if (client === null || subscriberId === null || permission !== "granted") {
      return;
    }

    return pollInbox(client, subscriberId, (items) => {
      presentRef.current(items);
    });
  }, [client, subscriberId, permission]);

  function advance(): void {
    const next = queueRef.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
  }

  if (client === null || current === null) {
    return null;
  }

  return (
    <ToastCard
      key={current.notification.id}
      item={current}
      icon={icon}
      onShown={() => {
        void client
          .openNotification(current.subscriberId, current.notification.id)
          .catch(() => undefined);
      }}
      onPress={() => {
        const deliveryId = notificationDeliveryId(current.notification);

        if (deliveryId !== null) {
          void client.clickDelivery(deliveryId).catch(() => undefined);
        }

        const url = current.notification.url;
        const openDeepLink = client.config.onDeepLink;

        if (url !== null && openDeepLink !== undefined) {
          console.info(`[Notifiable] Opening ${url}`);
          openDeepLink(url);
        }
      }}
      onDismiss={advance}
    />
  );
}

function pollInbox(
  client: NotifiableClient,
  subscriberId: string,
  present: (items: readonly SubscriberNotification[]) => void,
): () => void {
  const poll = {
    cancelled: false,
    stopped: false,
    inFlight: false,
    delay: pollMs,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  const seenOrder: string[] = [];

  function remember(id: string): void {
    if (seen.has(id)) {
      return;
    }

    seen.add(id);
    seenOrder.push(id);

    if (seenOrder.length > seenLimit) {
      const oldest = seenOrder.shift();

      if (oldest !== undefined) {
        seen.delete(oldest);
      }
    }
  }

  function arm(wait: number): void {
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      void run();
    }, wait);
  }

  async function run(): Promise<void> {
    if (isPollStopped(poll) || poll.inFlight) {
      return;
    }

    if (AppState.currentState !== "active") {
      arm(poll.delay);
      return;
    }

    poll.inFlight = true;
    console.info(`[Notifiable] Polling notifications for ${subscriberId}`);

    try {
      const notifications = (
        await client.listNotifications(subscriberId, {
          page: 1,
          opened: false,
        })
      ).notifications;

      if (isPollStopped(poll)) {
        return;
      }

      poll.delay = pollMs;
      const fresh = selectFreshNotifications(notifications, Date.now(), seen);

      for (const notification of fresh) {
        remember(notification.id);
        const title =
          notification.title.length > 0 ? notification.title : notification.id;
        console.info(`[Notifiable] New notification: ${title}`);
      }

      if (fresh.length > 0) {
        present(fresh);
      }
    } catch (error) {
      const code = error instanceof NotifiableError ? error.code : "network";

      if (code === "invalid_public_key" || code === "subscriber_not_found") {
        poll.stopped = true;
        return;
      }

      if (code === "rate_limited") {
        poll.delay = Math.min(poll.delay * 2, maxPollMs);
      }
    } finally {
      poll.inFlight = false;
    }

    if (!isPollStopped(poll)) {
      arm(poll.delay);
    }
  }

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void run();
    }
  });

  void run();

  return () => {
    poll.cancelled = true;

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    subscription.remove();
  };
}

function ToastCard({
  item,
  icon,
  onShown,
  onPress,
  onDismiss,
}: {
  readonly item: QueuedToast;
  readonly icon: string;
  readonly onShown: () => void;
  readonly onPress: () => void;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const onShownRef = useRef(onShown);
  const onDismissRef = useRef(onDismiss);
  const leaveRef = useRef<() => void>(() => undefined);
  onShownRef.current = onShown;
  onDismissRef.current = onDismiss;

  function leave(): void {
    if (leaving.current) {
      return;
    }

    leaving.current = true;
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: easeInCubic,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        onDismissRef.current();
      }
    });
  }

  leaveRef.current = leave;

  useEffect(() => {
    onShownRef.current();
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      easing: easeOutCubic,
      useNativeDriver: true,
    });
    animation.start();
    const timer = setTimeout(() => {
      leaveRef.current();
    }, visibleMs);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [progress]);

  const title =
    item.notification.title.length > 0
      ? item.notification.title
      : "Notification";

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.scrim, { opacity: progress }]}
      />
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.toast,
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0, 1, 1],
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-58, 0],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onPress();
            leaveRef.current();
          }}
          style={styles.card}
        >
          <Image source={{ uri: icon }} style={styles.icon} />
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text numberOfLines={1} style={styles.title}>
                {title}
              </Text>
              <Text style={styles.when}>now</Text>
            </View>
            {item.notification.body.length > 0 ? (
              <Text numberOfLines={2} style={styles.body}>
                {item.notification.body}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}

function isPollStopped(poll: {
  readonly cancelled: boolean;
  readonly stopped: boolean;
}): boolean {
  return poll.cancelled || poll.stopped;
}

function toastIcon(icon: string | null | undefined): string {
  if (icon !== undefined && icon !== null && /^https?:\/\//.test(icon)) {
    return icon;
  }

  return markIcon;
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function easeInCubic(value: number): number {
  return value ** 3;
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  toast: {
    position: "absolute",
    top: 58,
    left: 12,
    right: 12,
    zIndex: 31,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "#f4f5f7",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },
  when: {
    color: "#9aa0a6",
    fontSize: 12,
  },
  body: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 18,
  },
});
