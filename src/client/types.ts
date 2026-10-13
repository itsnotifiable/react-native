import type { Logger } from "../domain/logger";
import type { KeyValueStore } from "../domain/storage";
import type {
  DeliveryConfig,
  IdentifyInput,
  PermissionStatus,
  Subscriber,
} from "../domain/subscriber";
import type { NotifiableError } from "../domain/errors";
import type { DeepLink } from "../domain/deep-link";
import type { DevIndicatorChoice } from "../domain/dev-indicator";
import type {
  InboxPage,
  InboxQuery,
  SubscriberNotification,
} from "../domain/inbox";
import type { NotifiableEnvironment } from "../domain/environment";
import type { DevicePort, PushPort } from "../platform/types";

export interface NotifiableConfig {
  readonly publicKey: string;
  readonly environment?: NotifiableEnvironment;
  readonly baseUrl?: string;
  readonly logger?: Logger;
  readonly push?: PushPort;
  readonly storage?: KeyValueStore;
  readonly device?: DevicePort;
  readonly deepLinks?: readonly DeepLink[];
  readonly onDeepLink?: (url: string) => void;
}

export interface NotifiableSnapshot {
  readonly ready: boolean;
  readonly permission: PermissionStatus;
  readonly subscriber: Subscriber | null;
  readonly clientConfig: DeliveryConfig | null;
  readonly devIndicator: DevIndicatorChoice | null;
  readonly deepLinks: readonly DeepLink[] | null;
  readonly error: NotifiableError | null;
}

export interface NotifiableClient {
  readonly config: NotifiableConfig;
  start(): Promise<void>;
  requestPermission(): Promise<PermissionStatus>;
  identify(input: IdentifyInput): Promise<Subscriber>;
  setDevIndicator(enabled: boolean): Promise<void>;
  listNotifications(
    subscriberId: string,
    query?: InboxQuery,
  ): Promise<InboxPage>;
  inbox(query?: InboxQuery): Promise<InboxPage>;
  notification(notificationId: string): Promise<SubscriberNotification>;
  openNotification(subscriberId: string, notificationId: string): Promise<void>;
  openStoredNotification(notificationId: string): Promise<void>;
  clickDelivery(deliveryId: string): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): NotifiableSnapshot;
}

export interface NotifiableBinding {
  readonly config: NotifiableConfig;
  readonly ready: boolean;
  readonly permission: PermissionStatus;
  readonly subscriber: Subscriber | null;
  readonly clientConfig: DeliveryConfig | null;
  readonly devIndicator: DevIndicatorChoice | null;
  readonly deepLinks: readonly DeepLink[] | null;
  readonly error: NotifiableError | null;
  start(): Promise<void>;
  requestPermission(): Promise<PermissionStatus>;
  identify(input: IdentifyInput): Promise<Subscriber>;
  setDevIndicator(enabled: boolean): Promise<void>;
  inbox(query?: InboxQuery): Promise<InboxPage>;
  notification(notificationId: string): Promise<SubscriberNotification>;
  openNotification(notificationId: string): Promise<void>;
  clickDelivery(deliveryId: string): Promise<void>;
}

export type { Logger } from "../domain/logger";
export type { KeyValueStore } from "../domain/storage";
export type { NotifiableEnvironment } from "../domain/environment";
export type { DeepLink } from "../domain/deep-link";
export type { DevIndicatorChoice } from "../domain/dev-indicator";
export type {
  InboxPage,
  InboxQuery,
  SubscriberNotification,
} from "../domain/inbox";
export type {
  ClientApp,
  ClientEnvironment,
  DeliveryConfig,
  IdentifyInput,
  PermissionStatus,
  PushProvider,
  Subscriber,
} from "../domain/subscriber";
export type { DevicePort, PushPort } from "../platform/types";
