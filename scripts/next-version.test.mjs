import { nextVersion } from "./next-version.mjs";
import { describe, expect, it } from "vitest";

describe("nextVersion", () => {
  it("advances the patch until 9, then the minor, then the major", () => {
    expect(nextVersion("0.1.0")).toBe("0.1.1");
    expect(nextVersion("0.1.8")).toBe("0.1.9");
    expect(nextVersion("0.1.9")).toBe("0.2.0");
    expect(nextVersion("0.9.9")).toBe("1.0.0");
    expect(nextVersion("1.0.9")).toBe("1.1.0");
    expect(nextVersion("1.9.9")).toBe("2.0.0");
  });
});
