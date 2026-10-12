declare const brand: unique symbol;

type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type PublicKey = Brand<string, "PublicKey">;
export type UserId = Brand<string, "UserId">;
export type DeviceId = Brand<string, "DeviceId">;

export function asPublicKey(value: string): PublicKey {
  return value as PublicKey;
}
