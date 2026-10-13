import { useCallback, useContext, useSyncExternalStore } from "react";
import type { NotifiableBinding } from "../client/types";
import type { InboxQuery } from "../domain/inbox";
import type { IdentifyInput } from "../domain/subscriber";
import { NotifiableError } from "../domain/errors";
import { NotifiableContext } from "./context";

export function useNotifiable(): NotifiableBinding {
  const client = useContext(NotifiableContext);

  if (client === null) {
    throw new NotifiableError({
      code: "missing_provider",
      message: "useNotifiable must be used within NotifiableProvider",
    });
  }

  const subscribe = useCallback(
    (listener: () => void) => client.subscribe(listener),
    [client],
  );
  const getSnapshot = useCallback(() => client.getSnapshot(), [client]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const start = useCallback(() => client.start(), [client]);
  const requestPermission = useCallback(
    () => client.requestPermission(),
    [client],
  );
  const identify = useCallback(
    (input: IdentifyInput) => client.identify(input),
    [client],
  );
  const setDevIndicator = useCallback(
    (enabled: boolean) => client.setDevIndicator(enabled),
    [client],
  );
  const inbox = useCallback(
    (query?: InboxQuery) =>
      query === undefined ? client.inbox() : client.inbox(query),
    [client],
  );
  const notification = useCallback(
    (notificationId: string) => client.notification(notificationId),
    [client],
  );
  const openNotification = useCallback(
    (notificationId: string) => client.openStoredNotification(notificationId),
    [client],
  );
  const clickDelivery = useCallback(
    (deliveryId: string) => client.clickDelivery(deliveryId),
    [client],
  );

  return {
    config: client.config,
    ready: snapshot.ready,
    permission: snapshot.permission,
    subscriber: snapshot.subscriber,
    clientConfig: snapshot.clientConfig,
    devIndicator: snapshot.devIndicator,
    deepLinks: snapshot.deepLinks,
    error: snapshot.error,
    start,
    requestPermission,
    identify,
    setDevIndicator,
    inbox,
    notification,
    openNotification,
    clickDelivery,
  };
}
