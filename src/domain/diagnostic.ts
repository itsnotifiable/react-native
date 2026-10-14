import { NotifiableError } from "./errors";
import type { MobilePlatform } from "./subscriber";

export const sdkVersion = "0.0.0";

export type DiagnosticsChoice = "enabled" | "disabled";

export interface StackFrame {
  readonly function: string;
  readonly file: string;
  readonly line: number;
}

export interface DiagnosticCrash {
  readonly id: string;
  readonly kind: "crash";
  readonly sdk: "react-native";
  readonly sdkVersion: string;
  readonly platform: MobilePlatform;
  readonly occurredAt: string;
  readonly error: {
    readonly type: string;
    readonly message: string;
    readonly frames: readonly StackFrame[];
  };
  readonly subscriberId?: string;
}

const framePatterns: readonly RegExp[] = [
  /^\s*at\s+(?:async\s+)?(.*?)\s+\((?:address at\s+)?(.+):(\d+):\d+\)$/,
  /^(.+?)@(.+):(\d+):\d+$/,
  /^\s*at\s+(?:async\s+)?(.+):(\d+):\d+$/,
];

const uuidPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function parseStack(stack: string | undefined): readonly StackFrame[] {
  if (stack === undefined || stack.length === 0) {
    return [];
  }

  const frames: StackFrame[] = [];

  for (const line of stack.split("\n")) {
    const frame = parseFrame(line);

    if (frame === null) {
      continue;
    }

    frames.push(frame);

    if (frames.length === 20) {
      break;
    }
  }

  return frames;
}

export function describeCrash(error: unknown): {
  readonly type: string;
  readonly message: string;
  readonly frames: readonly StackFrame[];
} {
  if (error instanceof NotifiableError) {
    return {
      type: limit(`NotifiableError.${error.code}`, 200),
      message: limit(error.message, 2000),
      frames: parseStack(error.stack),
    };
  }

  if (error instanceof Error) {
    return {
      type: limit(error.name.length > 0 ? error.name : "Error", 200),
      message: limit(error.message, 2000),
      frames: parseStack(error.stack),
    };
  }

  return {
    type: "Error",
    message: limit(
      typeof error === "string" ? error : "The request failed.",
      2000,
    ),
    frames: [],
  };
}

export function crashFingerprint(
  type: string,
  message: string,
  frames: readonly StackFrame[],
): string {
  const frame = frames[0];
  const site =
    frame === undefined ? "" : `${frame.function}|${frame.file}|${frame.line}`;

  return `${type}|${message}|${site}`;
}

export function diagnosticSubscriberId(
  subscriberId: string | null,
): string | undefined {
  if (subscriberId !== null && uuidPattern.test(subscriberId)) {
    return subscriberId;
  }

  return undefined;
}

function parseFrame(line: string): StackFrame | null {
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return null;
  }

  for (const pattern of framePatterns) {
    const match = pattern.exec(trimmed);

    if (match === null) {
      continue;
    }

    const rawFunction = match[1] ?? "";
    const rawFile = match[2] ?? "";
    const rawLine = match[3] ?? "";
    const lineNumber = Number(rawLine);
    const file = limit(rawFile.trim(), 500);
    const name = rawFunction.trim();

    if (file.length === 0 || !Number.isInteger(lineNumber) || lineNumber < 1) {
      return null;
    }

    return {
      function: limit(name.length > 0 ? name : "anonymous", 200),
      file,
      line: lineNumber,
    };
  }

  return null;
}

function limit(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
