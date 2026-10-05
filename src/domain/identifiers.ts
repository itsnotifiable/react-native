declare const brand: unique symbol;

type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type AppKey = Brand<string, "AppKey">;
export type UserId = Brand<string, "UserId">;
export type DeviceId = Brand<string, "DeviceId">;

export function asAppKey(value: string): AppKey {
  return value as AppKey;
}
