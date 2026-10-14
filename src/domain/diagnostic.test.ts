import { describe, expect, it } from "vitest";
import { NotifiableError } from "./errors";
import { describeCrash, parseStack } from "./diagnostic";

describe("diagnostic stack", () => {
  it("reads a React Native stack frame", () => {
    const stack = [
      "NotifiableError: offline",
      "    at NotifiableClientImpl.#syncDevice (/Users/user/project/src/client/notifiable-client.ts:266:23)",
      "    at anonymous (address at index.bundle:1:900)",
    ].join("\n");

    expect(parseStack(stack)).toEqual([
      {
        function: "NotifiableClientImpl.#syncDevice",
        file: "/Users/user/project/src/client/notifiable-client.ts",
        line: 266,
      },
      {
        function: "anonymous",
        file: "index.bundle",
        line: 1,
      },
    ]);
  });

  it("names a NotifiableError by its code", () => {
    const described = describeCrash(
      new NotifiableError({ code: "network", message: "offline" }),
    );

    expect(described.type).toBe("NotifiableError.network");
    expect(described.message).toBe("offline");
  });
});
