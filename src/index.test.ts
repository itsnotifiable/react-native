import { describe, expect, it, vi } from "vitest";
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
  it("connects to the Notifiable API", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ status: "error", message: "no" }),
      });
    });

    try {
      const client = createNotifiable({
        publicKey: " ntf_pub_prod ",
        storage: {
          getItem: () => Promise.resolve(null),
          setItem: () => Promise.resolve(),
          removeItem: () => Promise.resolve(),
        },
      });

      await expect(client.start()).rejects.toMatchObject({
        code: "network",
      });
      expect(client.config.publicKey).toBe("ntf_pub_prod");
      expect(urls[0]).toBe("https://notifiable.sh/api/v1/sdk/client-config");
    } finally {
      vi.unstubAllGlobals();
    }
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
