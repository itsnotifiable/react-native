import type { KeyValueStore } from "../domain/storage";

export function createMemoryStorage(
  initial: Readonly<Record<string, string>> = {},
): KeyValueStore {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    getItem(key: string): Promise<string | null> {
      return Promise.resolve(values.get(key) ?? null);
    },
    setItem(key: string, value: string): Promise<void> {
      values.set(key, value);
      return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
      values.delete(key);
      return Promise.resolve();
    },
  };
}
