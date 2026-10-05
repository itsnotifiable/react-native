import type { Logger } from "../domain/logger";

export interface NotifiableConfig {
  readonly appKey: string;
  readonly baseUrl?: string;
  readonly logger?: Logger;
}

export interface NotifiableClient {
  readonly config: NotifiableConfig;
}

export type { Logger } from "../domain/logger";
