import { NotifiableError } from "../domain/errors";
import { deviceAddress } from "../domain/locale";
import { isRecord } from "../domain/record";
import type { DeviceProfile, MobilePlatform } from "../domain/subscriber";
import type { DevicePort } from "./types";

interface ReactNativePlatform {
  readonly OS: string;
  readonly Version?: string | number;
}

interface NativeDevice {
  readonly model: string | null;
  readonly manufacturer: string | null;
  readonly appVersion: string | null;
  readonly ip: string | null;
}

const emptyDevice: NativeDevice = {
  model: null,
  manufacturer: null,
  appVersion: null,
  ip: null,
};

export function createDevicePort(): DevicePort {
  return {
    async getProfile(): Promise<DeviceProfile> {
      const loaded = loadReactNative();
      const platform = readPlatform(loaded.Platform);
      const native = await readNativeDevice(loaded.NativeModules);
      const options = Intl.DateTimeFormat().resolvedOptions();
      const version = platform.Version;
      const locale = options.locale;
      const timezone = options.timeZone;

      return {
        platform: mobilePlatform(platform.OS),
        osVersion:
          typeof version === "string" || typeof version === "number"
            ? String(version)
            : null,
        locale: locale.length > 0 ? locale : null,
        timezone: timezone.length > 0 ? timezone : null,
        model: native.model,
        manufacturer: native.manufacturer,
        appVersion: native.appVersion,
        ip: native.ip,
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

declare function require(moduleName: "react-native"): unknown;

function loadReactNative(): Record<string, unknown> {
  // A dynamic import() is an async Metro require, and that module id is not in
  // this bundle. require() only reads Platform and the device module, so
  // PushNotificationIOS stays unloaded.
  try {
    const loaded: unknown = require("react-native");

    if (!isRecord(loaded)) {
      throw new Error("react-native could not be loaded.");
    }

    return loaded;
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

function readPlatform(loaded: unknown): ReactNativePlatform {
  const candidate =
    isRecord(loaded) && isRecord(loaded.default) ? loaded.default : loaded;

  if (!isRecord(candidate) || typeof candidate.OS !== "string") {
    throw new NotifiableError({
      code: "invalid_config",
      message: "react-native Platform could not be loaded.",
    });
  }

  const version = candidate.Version;

  return {
    OS: candidate.OS,
    ...(typeof version === "string" || typeof version === "number"
      ? { Version: version }
      : {}),
  };
}

async function readNativeDevice(loaded: unknown): Promise<NativeDevice> {
  if (!isRecord(loaded)) {
    return emptyDevice;
  }

  const device = loaded.NotifiableDevice;

  if (!isRecord(device)) {
    return emptyDevice;
  }

  const getInfo = device.getInfo;

  if (!isInfoReader(getInfo)) {
    return emptyDevice;
  }

  try {
    const info: unknown = await getInfo();

    if (!isRecord(info)) {
      return emptyDevice;
    }

    return {
      model: clip(info.model, 80),
      manufacturer: clip(info.manufacturer, 80),
      appVersion: clip(info.appVersion, 40),
      ip: deviceAddress(typeof info.ip === "string" ? info.ip : null),
    };
  } catch {
    return emptyDevice;
  }
}

function isInfoReader(value: unknown): value is () => Promise<unknown> {
  return typeof value === "function";
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
