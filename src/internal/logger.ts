import type { Logger } from "../domain/logger";

export const noopLogger: Logger = {
  debug(): void {
    return;
  },
  info(): void {
    return;
  },
  warn(): void {
    return;
  },
  error(): void {
    return;
  },
};

export function resolveLogger(logger: Logger | undefined): Logger {
  return logger ?? noopLogger;
}
