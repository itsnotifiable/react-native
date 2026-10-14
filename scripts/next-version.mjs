export function nextVersion(version) {
  const parts = version.split(".");

  if (parts.length !== 3) {
    throw new Error(`Version must be major.minor.patch, received ${version}.`);
  }

  const numbers = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error(
        `Version must be major.minor.patch, received ${version}.`,
      );
    }

    return Number(part);
  });

  let major = numbers[0];
  let minor = numbers[1];
  let patch = numbers[2] + 1;

  if (patch > 9) {
    patch = 0;
    minor += 1;
  }

  if (minor > 9) {
    minor = 0;
    major += 1;
  }

  return `${major}.${minor}.${patch}`;
}
