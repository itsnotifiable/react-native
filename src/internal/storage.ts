import { NotifiableError } from "../domain/errors";
import type { KeyValueStore } from "../domain/storage";

export async function loadDefaultStorage(): Promise<KeyValueStore> {
  const specifier = "@react-native-async-storage/async-storage";

  try {
    const imported = (await import(specifier)) as { default?: KeyValueStore };
    const storage = imported.default;

    if (storage === undefined || typeof storage.getItem !== "function") {
      throw new NotifiableError({
        code: "missing_storage",
        message: missingStorageMessage,
      });
    }

    return storage;
  } catch (error) {
    if (error instanceof NotifiableError) {
      throw error;
    }

    throw new NotifiableError({
      code: "missing_storage",
      message: missingStorageMessage,
    });
  }
}

const missingStorageMessage =
  "Install @react-native-async-storage/async-storage or pass storage to createNotifiable.";
