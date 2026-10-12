import type { Logger } from "../domain/logger";
import type { KeyValueStore } from "../domain/storage";
import type {
  IdentifyInput,
  PermissionStatus,
  Subscriber,
} from "../domain/subscriber";
import type { NotifiableError } from "../domain/errors";
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
}

export interface NotifiableSnapshot {
  readonly ready: boolean;
  readonly permission: PermissionStatus;
  readonly subscriber: Subscriber | null;
  readonly error: NotifiableError | null;
}

export interface NotifiableClient {
  readonly config: NotifiableConfig;
  start(): Promise<void>;
  requestPermission(): Promise<PermissionStatus>;
  identify(input: IdentifyInput): Promise<Subscriber>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): NotifiableSnapshot;
}

export interface NotifiableBinding {
  readonly config: NotifiableConfig;
  readonly ready: boolean;
  readonly permission: PermissionStatus;
  readonly subscriber: Subscriber | null;
  readonly error: NotifiableError | null;
  start(): Promise<void>;
  requestPermission(): Promise<PermissionStatus>;
  identify(input: IdentifyInput): Promise<Subscriber>;
}

export type { Logger } from "../domain/logger";
export type { KeyValueStore } from "../domain/storage";
export type { NotifiableEnvironment } from "../domain/environment";
export type {
  IdentifyInput,
  PermissionStatus,
  PushProvider,
  Subscriber,
} from "../domain/subscriber";
export type { DevicePort, PushPort } from "../platform/types";
