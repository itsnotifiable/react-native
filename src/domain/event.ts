export type EventProperty = string | number | boolean | null;

export interface RecordedEvent {
  readonly id: string;
  readonly name: string;
  readonly subscriberId: string;
}
