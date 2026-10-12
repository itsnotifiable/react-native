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
      "invalid_public_key",
      "network",
      "validation_failed",
      "subscriber_not_found",
      "subscriber_limit",
      "rate_limited",
      "missing_token",
      "missing_storage",
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
  it("uses the local and production hosts", () => {
    const local = createNotifiable({
      publicKey: " ntf_pub_local ",
      environment: "local",
    });
    const production = createNotifiable({
      publicKey: "ntf_pub_prod",
    });
    const custom = createNotifiable({
      publicKey: "ntf_pub_custom",
      baseUrl: "https://example.test/api/",
    });

    expect(local.config).toMatchObject({
      publicKey: "ntf_pub_local",
      environment: "local",
      baseUrl: "http://127.0.0.1:8000/api",
    });
    expect(production.config).toMatchObject({
      environment: "production",
      baseUrl: "https://notifiable.sh/api",
    });
    expect(custom.config.baseUrl).toBe("https://example.test/api");
    expect(custom.config.environment).toBeUndefined();
    expect(local.config.logger).toBeUndefined();
  });

  it("rejects a blank public key", () => {
    expect.assertions(2);

    try {
      createNotifiable({ publicKey: "   " });
    } catch (error) {
      expect(error).toBeInstanceOf(NotifiableError);
      expect(error).toMatchObject({ code: "invalid_config" });
    }
  });
});
