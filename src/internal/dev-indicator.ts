import type { DevIndicatorChoice } from "../domain/dev-indicator";
import type { KeyValueStore } from "../domain/storage";

export function devIndicatorKey(publicKey: string): string {
  return `notifiable.dev-indicator.${publicKey}`;
}

export async function loadDevIndicator(
  storage: KeyValueStore,
  publicKey: string,
): Promise<DevIndicatorChoice | null> {
  const raw = await storage.getItem(devIndicatorKey(publicKey));

  if (raw === "enabled" || raw === "disabled") {
    return raw;
  }

  return null;
}

export async function saveDevIndicator(
  storage: KeyValueStore,
  publicKey: string,
  choice: DevIndicatorChoice,
): Promise<void> {
  await storage.setItem(devIndicatorKey(publicKey), choice);
}
