import { createContext } from "react";
import type { NotifiableClient } from "../client/types";

export const NotifiableContext = createContext<NotifiableClient | null>(null);
