import { describe, expect, it } from "vitest";
import { deviceAddress, localeParts } from "./locale";

describe("locale parts", () => {
  it("reads the language and region", () => {
    expect(localeParts("en-MA")).toEqual({
      language: "en",
      countryCode: "MA",
    });
    expect(localeParts("zh-Hans-CN")).toEqual({
      language: "zh",
      countryCode: "CN",
    });
    expect(localeParts("en")).toEqual({ language: "en", countryCode: null });
  });

  it("drops a loopback address", () => {
    expect(deviceAddress("192.168.1.20")).toBe("192.168.1.20");
    expect(deviceAddress("127.0.0.1")).toBeNull();
  });
});
