import type { DiagnosticsChoice } from "../domain/diagnostic";
import type { KeyValueStore } from "../domain/storage";

export function diagnosticsKey(publicKey: string): string {
  return `notifiable.diagnostics.${publicKey}`;
}

export async function loadDiagnostics(
  storage: KeyValueStore,
  publicKey: string,
): Promise<DiagnosticsChoice | null> {
  const raw = await storage.getItem(diagnosticsKey(publicKey));

  if (raw === "enabled" || raw === "disabled") {
    return raw;
  }

  return null;
}

export async function saveDiagnostics(
  storage: KeyValueStore,
  publicKey: string,
  choice: DiagnosticsChoice,
): Promise<void> {
  await storage.setItem(diagnosticsKey(publicKey), choice);
}
