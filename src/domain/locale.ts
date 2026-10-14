export interface LocaleParts {
  readonly language: string | null;
  readonly countryCode: string | null;
}

const languagePattern = /^[A-Za-z]{2,8}$/;
const regionPattern = /^[A-Za-z]{2}$/;
const ipv4Pattern =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function localeParts(locale: string | null): LocaleParts {
  if (locale === null) {
    return { language: null, countryCode: null };
  }

  const tags = locale.split(/[-_]/).filter((tag) => tag.length > 0);
  const first = tags[0];
  const language =
    first !== undefined && languagePattern.test(first)
      ? first.toLowerCase()
      : null;
  let countryCode: string | null = null;

  for (const tag of tags.slice(1)) {
    if (regionPattern.test(tag)) {
      countryCode = tag.toUpperCase();
    }
  }

  return { language, countryCode };
}

export function deviceAddress(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const address = value.trim();

  if (
    !ipv4Pattern.test(address) ||
    address === "0.0.0.0" ||
    address.startsWith("127.")
  ) {
    return null;
  }

  return address;
}
