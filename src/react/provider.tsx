import React, { useEffect, useMemo, type ReactNode } from "react";
import { createNotifiable } from "../client/create-client";
import type { NotifiableClient, NotifiableConfig } from "../client/types";
import { NotifiableError } from "../domain/errors";
import { NotifiableContext } from "./context";

export interface NotifiableProviderProps extends Partial<
  Pick<
    NotifiableConfig,
    | "publicKey"
    | "environment"
    | "baseUrl"
    | "logger"
    | "push"
    | "storage"
    | "device"
  >
> {
  readonly client?: NotifiableClient;
  readonly children: ReactNode;
}

export function NotifiableProvider({
  children,
  client,
  publicKey,
  environment,
  baseUrl,
  logger,
  push,
  storage,
  device,
}: NotifiableProviderProps): React.JSX.Element {
  const resolved = useMemo(() => {
    if (client !== undefined) {
      return client;
    }

    const key = publicKey?.trim() ?? "";

    if (key.length === 0) {
      throw new NotifiableError({
        code: "invalid_config",
        message: "NotifiableProvider requires a client or publicKey.",
      });
    }

    return createNotifiable({
      publicKey: key,
      ...(environment !== undefined ? { environment } : {}),
      ...(baseUrl !== undefined ? { baseUrl } : {}),
      ...(logger !== undefined ? { logger } : {}),
      ...(push !== undefined ? { push } : {}),
      ...(storage !== undefined ? { storage } : {}),
      ...(device !== undefined ? { device } : {}),
    });
  }, [client, publicKey, environment, baseUrl, logger, push, storage, device]);

  useEffect(() => {
    void resolved.start().catch(() => undefined);
  }, [resolved]);

  return (
    <NotifiableContext.Provider value={resolved}>
      {children}
    </NotifiableContext.Provider>
  );
}
