export const notifiableErrorCodes = [
  "invalid_config",
  "missing_provider",
  "not_implemented",
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
