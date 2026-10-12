export const notifiableErrorCodes = [
  "invalid_config",
  "missing_provider",
  "not_implemented",
  "invalid_public_key",
  "network",
  "validation_failed",
  "subscriber_not_found",
  "subscriber_limit",
  "rate_limited",
  "missing_token",
  "missing_storage",
] as const;

export type NotifiableErrorCode = (typeof notifiableErrorCodes)[number];

export class NotifiableError extends Error {
  readonly code: NotifiableErrorCode;

  constructor(options: {
    readonly code: NotifiableErrorCode;
    readonly message?: string;
  }) {
    super(options.message ?? options.code);
    this.name = "NotifiableError";
    this.code = options.code;
  }
}

export function asNotifiableError(error: unknown): NotifiableError {
  if (error instanceof NotifiableError) {
    return error;
  }

  return new NotifiableError({
    code: "network",
    message: error instanceof Error ? error.message : "The request failed.",
  });
}
