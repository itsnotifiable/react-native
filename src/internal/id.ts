export function createId(): string {
  const cryptoApi = (
    globalThis as {
      crypto?: {
        randomUUID?: () => string;
        getRandomValues?: (bytes: Uint8Array) => Uint8Array;
      };
    }
  ).crypto;

  if (cryptoApi?.randomUUID !== undefined) {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (cryptoApi?.getRandomValues !== undefined) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const sixth = bytes[6] ?? 0;
  const eighth = bytes[8] ?? 0;
  bytes[6] = (sixth & 0x0f) | 0x40;
  bytes[8] = (eighth & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
