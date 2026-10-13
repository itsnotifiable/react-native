import { NotifiableError } from "../domain/errors";
import { isRecord } from "../domain/record";
import type { DeviceProfile, MobilePlatform } from "../domain/subscriber";
import type { DevicePort } from "./types";

interface ReactNativePlatform {
  readonly OS: string;
  readonly Version?: string | number;
}

export function createDevicePort(): DevicePort {
  return {
    getProfile(): Promise<DeviceProfile> {
      const platform = loadPlatform();
      const options = Intl.DateTimeFormat().resolvedOptions();
      const version = platform.Version;
      const locale = options.locale;
      const timezone = options.timeZone;

      return Promise.resolve({
        platform: mobilePlatform(platform.OS),
        osVersion:
          typeof version === "string" || typeof version === "number"
            ? String(version)
            : null,
        locale: locale.length > 0 ? locale : null,
        timezone: timezone.length > 0 ? timezone : null,
      });
    },
  };
}

function mobilePlatform(os: string): MobilePlatform {
  if (os === "ios" || os === "android") {
    return os;
  }

  throw new NotifiableError({
    code: "invalid_config",
    message: `Unsupported platform ${os}.`,
  });
}

declare function require(moduleName: "react-native"): unknown;

function loadPlatform(): ReactNativePlatform {
  // A dynamic import() is an async Metro require, and that module id is not in
  // this bundle. require() only reads Platform, so PushNotificationIOS stays unloaded.
  try {
    const loaded: unknown = require("react-native");
    const platform = readPlatform(isRecord(loaded) ? loaded.Platform : loaded);

    if (platform === null) {
      throw new Error("react-native Platform could not be loaded.");
    }

    return platform;
  } catch (error) {
    throw new NotifiableError({
      code: "invalid_config",
      message:
        error instanceof Error
          ? error.message
          : "react-native could not be loaded.",
    });
  }
}

function readPlatform(loaded: unknown): ReactNativePlatform | null {
  const candidate =
    isRecord(loaded) && isRecord(loaded.default) ? loaded.default : loaded;

  if (!isRecord(candidate) || typeof candidate.OS !== "string") {
    return null;
  }

  const version = candidate.Version;

  return {
    OS: candidate.OS,
    ...(typeof version === "string" || typeof version === "number"
      ? { Version: version }
      : {}),
  };
}
