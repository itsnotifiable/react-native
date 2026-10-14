export type PackageCheck = "match" | "mismatch";

export function packageCheck(
  configured: string | null,
  applicationId: string | null,
): PackageCheck | null {
  if (applicationId === null || applicationId.length === 0) {
    return null;
  }

  if (configured === null || configured !== applicationId) {
    return "mismatch";
  }

  return "match";
}
