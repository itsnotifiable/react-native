export type NotifiableEnvironment = "local" | "production";

export const notifiableBaseUrls: Readonly<
  Record<NotifiableEnvironment, string>
> = {
  local: "http://127.0.0.1:8000/api",
  production: "https://notifiable.sh/api",
};
