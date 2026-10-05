import { NotifiableError, type NotifiableErrorCode } from "../domain/errors";

export function invariant(
  condition: unknown,
  code: NotifiableErrorCode,
  message: string,
): asserts condition {
  if (!condition) {
    throw new NotifiableError({ code, message });
  }
}
