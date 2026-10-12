import { NotifiableError } from "../domain/errors";
import type { DeviceProfile, MobilePlatform } from "../domain/subscriber";
import type { DevicePort } from "./types";

interface ReactNativeModule {
  readonly Platform: {
    readonly OS: string;
    readonly Version: string | number | undefined;
  };
}

export function createDevicePort(): DevicePort {
  return {
    async getProfile(): Promise<DeviceProfile> {
      const native = await loadReactNative();
      const options = Intl.DateTimeFormat().resolvedOptions();
      const version = native.Platform.Version;
      const locale = options.locale;
      const timezone = options.timeZone;

      return {
        platform: mobilePlatform(native.Platform.OS),
        osVersion:
          typeof version === "string" || typeof version === "number"
            ? String(version)
            : null,
        locale: locale.length > 0 ? locale : null,
        timezone: timezone.length > 0 ? timezone : null,
      };
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

async function loadReactNative(): Promise<ReactNativeModule> {
  const specifier = "react-native";

  try {
    return (await import(specifier)) as ReactNativeModule;
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
