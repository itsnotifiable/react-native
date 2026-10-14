export type PermissionStatus = "granted" | "denied" | "not_determined";

export type DevicePlatform = "ios" | "android" | "web";

export type MobilePlatform = "ios" | "android";

export type PushProvider = "apns" | "fcm" | "expo" | "web_push";

export interface Subscriber {
  readonly id: string;
  readonly environment: string;
  readonly platform: DevicePlatform;
  readonly permission: PermissionStatus;
  readonly sdk: string | null;
  readonly provider: PushProvider | null;
  readonly deviceId: string | null;
  readonly externalId: string | null;
  readonly anonymousId: string | null;
  readonly promptPermission: boolean;
}

export interface StoredSession {
  readonly deviceId: string;
  readonly subscriberId: string | null;
  readonly pushToken: string | null;
  readonly anonymousId: string | null;
}

export interface DeviceProfile {
  readonly platform: MobilePlatform;
  readonly osVersion: string | null;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly model: string | null;
  readonly manufacturer: string | null;
  readonly appVersion: string | null;
  readonly ip: string | null;
}

export interface SubscriberWrite {
  readonly deviceId: string;
  readonly platform: MobilePlatform;
  readonly permission: PermissionStatus;
  readonly provider?: PushProvider;
  readonly token?: string;
  readonly anonymousId?: string;
  readonly prompted?: boolean;
  readonly osVersion?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly model?: string;
  readonly manufacturer?: string;
  readonly appVersion?: string;
  readonly ip?: string;
  readonly language?: string;
  readonly countryCode?: string;
  readonly sdkVersion?: string;
}

export interface SubscriberIdentity {
  readonly email?: string;
  readonly externalId?: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly anonymousId?: string | null;
}

export interface IdentifyInput {
  readonly email?: string;
  readonly externalId?: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}

export type ClientEnvironment = "development" | "production";

export interface ClientApp {
  readonly name: string | null;
  readonly description: string | null;
  readonly icon: string | null;
}

export interface DeliveryConfig {
  readonly environment: ClientEnvironment | null;
  readonly app: ClientApp | null;
  readonly android: Readonly<Record<string, unknown>> | null;
  readonly ios: Readonly<Record<string, unknown>> | null;
  readonly web: Readonly<Record<string, unknown>> | null;
}

export function isPermissionStatus(value: unknown): value is PermissionStatus {
  return (
    value === "granted" || value === "denied" || value === "not_determined"
  );
}

export function isDevicePlatform(value: unknown): value is DevicePlatform {
  return value === "ios" || value === "android" || value === "web";
}

export function isPushProvider(value: unknown): value is PushProvider {
  return (
    value === "apns" ||
    value === "fcm" ||
    value === "expo" ||
    value === "web_push"
  );
}
