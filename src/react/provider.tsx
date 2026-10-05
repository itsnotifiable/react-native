import React, { type ReactNode } from "react";
import type { NotifiableClient } from "../client/types";
import { NotifiableContext } from "./context";

export interface NotifiableProviderProps {
  readonly client: NotifiableClient;
  readonly children: ReactNode;
}

export function NotifiableProvider({
  client,
  children,
}: NotifiableProviderProps): React.JSX.Element {
  return (
    <NotifiableContext.Provider value={client}>
      {children}
    </NotifiableContext.Provider>
  );
}
