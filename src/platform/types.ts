import type { DeviceProfile, PushProvider } from "../domain/subscriber";
import type { PermissionStatus } from "../domain/subscriber";

export interface PushPort {
  /**
   * Push service for the device token. When omitted, the client picks `apns`
   * on iOS and `fcm` on Android.
   */
  readonly provider?: PushProvider;
  /**
   * When true, a granted permission with an empty token still saves the
   * subscriber. The save omits the token and sends not_determined, because
   * the API rejects granted without a provider and token. Bare React Native
   * ports leave this unset and keep the missing_token failure.
   */
  readonly allowMissingToken?: boolean;
  getPermissionStatus?: () => Promise<PermissionStatus>;
  requestPermission: () => Promise<PermissionStatus>;
  getToken: () => Promise<string | null>;
}

export interface DevicePort {
  getProfile: () => Promise<DeviceProfile>;
  getApplicationId?: () => Promise<string | null>;
  copy?: (value: string) => void;
}
