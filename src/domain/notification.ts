import type { UserId } from "./identifiers";

export interface NotifiableUser {
  readonly id: UserId;
}

export interface NotificationContent {
  readonly title: string;
  readonly body: string;
}
