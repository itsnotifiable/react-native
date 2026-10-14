import { describe, expect, it } from "vitest";
import { packageCheck } from "./package-check";

describe("package check", () => {
  it("matches the identifier saved in Notifiable", () => {
    expect(packageCheck("com.notifiableexample", "com.notifiableexample")).toBe(
      "match",
    );
  });

  it("flags a different or missing configuration", () => {
    expect(
      packageCheck(
        "org.reactjs.native.example.NotifiableExample",
        "com.notifiableexample",
      ),
    ).toBe("mismatch");
    expect(packageCheck(null, "com.notifiableexample")).toBe("mismatch");
    expect(packageCheck("com.notifiableexample", null)).toBeNull();
  });
});
