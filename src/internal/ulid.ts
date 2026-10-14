const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function createUlid(time = Date.now()): string {
  return `${encodeTime(time)}${encodeRandom()}`;
}

function encodeTime(time: number): string {
  let value = time;
  const chars: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    chars.push(alphabet[value % 32] ?? "0");
    value = Math.floor(value / 32);
  }

  return chars.reverse().join("");
}

function encodeRandom(): string {
  const bytes = new Uint8Array(10);
  const cryptoApi = (
    globalThis as {
      crypto?: { getRandomValues?: (bytes: Uint8Array) => Uint8Array };
    }
  ).crypto;

  if (cryptoApi?.getRandomValues !== undefined) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let buffer = 0;
  let bits = 0;
  let encoded = "";

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      encoded += alphabet[(buffer >> bits) & 31] ?? "0";
    }
  }

  return encoded;
}
