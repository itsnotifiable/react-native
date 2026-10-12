import type { DeviceProfile, PushProvider } from "../domain/subscriber";
import type { PermissionStatus } from "../domain/subscriber";

export interface PushPort {
  readonly provider: PushProvider;
  getPermissionStatus?: () => Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  getToken(): Promise<string | null>;
}

export interface DevicePort {
  getProfile(): Promise<DeviceProfile>;
}
