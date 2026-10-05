import type { DeviceId } from "../domain/identifiers";
import type { NotificationContent } from "../domain/notification";

export type PermissionStatus = "undetermined" | "granted" | "denied";

export type DevicePlatform = "ios" | "android";

export interface DeviceToken {
  readonly id: DeviceId;
  readonly token: string;
  readonly platform: DevicePlatform;
}

export interface DisplayedNotification {
  readonly content: NotificationContent;
}

export interface PlatformAdapter {
  getPermissionStatus(): Promise<PermissionStatus>;
  getDeviceToken(): Promise<DeviceToken | null>;
}
