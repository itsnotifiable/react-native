import { isRecord } from "../domain/record";
import type { KeyValueStore } from "../domain/storage";
import type { StoredSession } from "../domain/subscriber";

export function sessionKey(publicKey: string): string {
  return `notifiable.session.${publicKey}`;
}

export async function loadSession(
  storage: KeyValueStore,
  publicKey: string,
): Promise<StoredSession | null> {
  const raw = await storage.getItem(sessionKey(publicKey));

  if (raw === null) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = parseJson(raw);
  } catch {
    return null;
  }

  if (
    !isRecord(parsed) ||
    typeof parsed.deviceId !== "string" ||
    parsed.deviceId.length === 0
  ) {
    return null;
  }

  return {
    deviceId: parsed.deviceId,
    subscriberId:
      typeof parsed.subscriberId === "string" ? parsed.subscriberId : null,
    pushToken: typeof parsed.pushToken === "string" ? parsed.pushToken : null,
    anonymousId:
      typeof parsed.anonymousId === "string" ? parsed.anonymousId : null,
  };
}

export async function saveSession(
  storage: KeyValueStore,
  publicKey: string,
  session: StoredSession,
): Promise<void> {
  await storage.setItem(sessionKey(publicKey), JSON.stringify(session));
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}
