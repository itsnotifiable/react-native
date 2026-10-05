import { NotifiableError } from "../domain/errors";
import type { DeviceToken, PermissionStatus, PlatformAdapter } from "./types";

export function createPlatformAdapter(): PlatformAdapter {
  return {
    getPermissionStatus(): Promise<PermissionStatus> {
      return Promise.reject(new NotifiableError({ code: "not_implemented" }));
    },
    getDeviceToken(): Promise<DeviceToken | null> {
      return Promise.reject(new NotifiableError({ code: "not_implemented" }));
    },
  };
}
