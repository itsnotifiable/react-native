import React, { useEffect, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { createNotifiable } from "../client/create-client";
import type { NotifiableClient, NotifiableConfig } from "../client/types";
import { NotifiableError } from "../domain/errors";
import { NotifiableContext } from "./context";
import { DevelopmentBadge } from "./dev-indicator";
import { DevToasts } from "./dev-toasts";
import { useNotifiable } from "./use-notifiable";

export interface NotifiableProviderProps extends Partial<
  Pick<
    NotifiableConfig,
    | "publicKey"
    | "logger"
    | "push"
    | "storage"
    | "device"
    | "deepLinks"
    | "onDeepLink"
  >
> {
  readonly client?: NotifiableClient;
  readonly children: ReactNode;
}

export function NotifiableProvider({
  children,
  client,
  publicKey,
  logger,
  push,
  storage,
  device,
  deepLinks,
  onDeepLink,
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
      ...(logger !== undefined ? { logger } : {}),
      ...(push !== undefined ? { push } : {}),
      ...(storage !== undefined ? { storage } : {}),
      ...(device !== undefined ? { device } : {}),
      ...(deepLinks !== undefined ? { deepLinks } : {}),
      ...(onDeepLink !== undefined ? { onDeepLink } : {}),
    });
  }, [client, publicKey, logger, push, storage, device, deepLinks, onDeepLink]);

  useEffect(() => {
    void resolved.start().catch(() => undefined);
  }, [resolved]);

  return (
    <NotifiableContext.Provider value={resolved}>
      <DevelopmentHost>{children}</DevelopmentHost>
    </NotifiableContext.Provider>
  );
}

function DevelopmentHost({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  const { clientConfig } = useNotifiable();

  if (clientConfig?.environment !== "development") {
    return <>{children}</>;
  }

  return (
    <View style={styles.developmentHost} pointerEvents="box-none">
      <DevelopmentBadge clientConfig={clientConfig}>
        {children}
      </DevelopmentBadge>
      <DevToasts />
    </View>
  );
}

const styles = StyleSheet.create({
  developmentHost: {
    flex: 1,
  },
});
