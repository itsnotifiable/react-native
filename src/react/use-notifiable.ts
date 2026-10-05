import { useContext } from "react";
import type { NotifiableClient } from "../client/types";
import { NotifiableError } from "../domain/errors";
import { NotifiableContext } from "./context";

export function useNotifiable(): NotifiableClient {
  const client = useContext(NotifiableContext);

  if (client === null) {
    throw new NotifiableError({
      code: "missing_provider",
      message: "useNotifiable must be used within NotifiableProvider",
    });
  }

  return client;
}
