import { describe, expect, it } from "vitest";
import {
  NotifiableError,
  NotifiableProvider,
  createNotifiable,
  notifiableErrorCodes,
  useNotifiable,
} from "./index";

describe("public exports", () => {
  it("exposes the client factory, react bindings, and error type", () => {
    expect(typeof createNotifiable).toBe("function");
    expect(typeof NotifiableProvider).toBe("function");
    expect(typeof useNotifiable).toBe("function");
    expect(NotifiableError.prototype).toBeInstanceOf(Error);
  });
});

describe("error codes", () => {
  it("uses a closed set of codes", () => {
    expect(notifiableErrorCodes).toEqual([
      "invalid_config",
      "missing_provider",
      "not_implemented",
    ]);
  });

  it("exposes the code on NotifiableError", () => {
    const error = new NotifiableError({
      code: "not_implemented",
      message: "Transport is not implemented",
    });

    expect(error).toBeInstanceOf(NotifiableError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NotifiableError");
    expect(error.code).toBe("not_implemented");
    expect(error.message).toBe("Transport is not implemented");
  });
});

describe("createNotifiable", () => {
  it("returns a client from config without other dependencies", () => {
    const client = createNotifiable({
      appKey: " app_123 ",
      baseUrl: "https://api.notifiable.sh",
    });

    expect(client.config.appKey).toBe("app_123");
    expect(client.config.baseUrl).toBe("https://api.notifiable.sh");
    expect(client.config.logger).toBeUndefined();
  });

  it("rejects a blank app key", () => {
    expect.assertions(2);

    try {
      createNotifiable({ appKey: "   " });
    } catch (error) {
      expect(error).toBeInstanceOf(NotifiableError);
      expect(error).toMatchObject({ code: "invalid_config" });
    }
  });
});
