---
name: notifiable
description: >-
  Explains the Notifiable push platform and the @notifiable/react-native SDK:
  public API, layer rules, and what is still unwired. Use when changing this
  package, adding SDK behavior, naming exports, or answering what Notifiable
  or this React Native package does.
---

# Notifiable

## Product

Notifiable (https://notifiable.sh) is a developer-first push notification platform. Apps connect with an SDK, ask for permission, register device tokens, and identify users. The service sends, schedules, segments, and automates notifications, and reports delivery and opens.

Supported clients: Expo, React Native, Flutter, Swift, Kotlin, and Web, plus a REST API at `https://api.notifiable.sh`. Notifiable manages Android and web delivery. iOS needs the app's Apple Developer account connected once.

The marketing site shows a singleton-style API (`Notifiable.configure`, `requestPermission`, `identify` with `projectId`). This package does not implement that shape. Keep the provider and `useNotifiable()` API below unless the user asks to change it.

## This package

`@notifiable/react-native` is the React Native SDK. It connects with a public key, registers a subscriber even when push permission is denied, and identifies that subscriber by email. Events, deep links, and production notification display are not implemented. A development key polls recent unread notifications and shows each one once as a top toast. This package does not ship Firebase, APNs, or Expo. The app passes a `PushPort`.

Consumers install it with `npm install @notifiable/react-native` and import only from `@notifiable/react-native`. Deep imports are not public. Persistent sessions need the optional peer `@react-native-async-storage/async-storage`, or a `storage` object on the config.

`environment: "local"` uses `http://127.0.0.1:8000/api`. `environment: "production"` uses `https://notifiable.sh/api`. Production is the default. Optional `baseUrl` overrides either host. SDK routes send `X-Notifiable-Key`. The key selects the server environment. The SDK does not send an environment name.

```tsx
<NotifiableProvider
  publicKey="ntf_pub_..."
  environment="local"
  push={{
    provider: "fcm",
    getPermissionStatus,
    requestPermission,
    getToken,
  }}
>
  <App />
</NotifiableProvider>
```

```ts
const { config, subscriber, permission, requestPermission, identify } =
  useNotifiable();

await requestPermission();
await identify({ email: "ada@example.com", externalId: "user_123" });
```

`createNotifiable` trims `publicKey` and throws `invalid_config` when it is blank. The provider builds a client from `publicKey` or accepts an existing `client`, then calls `start()` on mount. `start()` does not prompt. It loads the session, checks the key with `GET /v1/sdk/client-config`, stores that payload on `clientConfig`, and upserts `POST /v1/sdk/subscribers`. When `clientConfig.environment` is `development` and `devIndicator` is unset, the provider first shows a sheet that explains Notifiable and asks to show or hide the mark. Showing it stores `enabled` and puts a larger mark on screen, filled with the Notifiable icon from `https://notifiable.sh/favicon.png`. Dragging parks it on the nearest edge — top, right, bottom, or left — with space from the screen edge, and it stays there after the sheet closes. Tapping the mark slides open the app name, icon, and configured iOS bundle id or Android package name. Above the shortcut note, a switch labeled Share SDK diagnostics starts on and only changes in that sheet. Learn what is collected opens https://notifiable.sh/sdk-diagnostics. Hiding it stores `disabled` under `notifiable.dev-indicator.` plus the public key. On the iOS simulator, Command N shows the mark again, including while a text field is focused. The shortcut is registered by the iOS module in `ios/NotifiableKeyCommand.m`, and only while a development app is mounted. The sheet labels Development with an amber warning pill. While that subscriber id exists and the app is in the foreground, the provider polls `GET /v1/sdk/subscribers/{id}/notifications` every 5 seconds, logs each request and each new notification to the console, shows each unread alert from the last 8 seconds once as a top toast that expands from the Dynamic Island over a light black overlay, then records the open. A tap records a delivery click only when the notification includes `delivery_id`. A 429 slows the poll; a 401 or a missing subscriber stops it until the subscriber changes. Hiding the mark does not stop the poll. A production key does not show the sheet, the mark, or the toasts. The same `device_id` updates the existing subscriber. `token` and `provider` are sent only when permission is `granted` and `getToken()` returns a string. A granted permission with an empty token throws `missing_token` and does not register that grant.

`identify` patches `/v1/sdk/subscribers/{id}`. When `email` or `externalId` is set, the patch also sends `anonymous_id: null`. The first save sends a generated `anonymous_id`. Later device syncs omit identity fields.

The stored session is `deviceId`, `subscriberId`, `pushToken`, and `anonymousId` under `notifiable.session.` plus the public key. The API does not return a subscriber secret.

`start`, `requestPermission`, and `identify` share one promise queue.

## Public exports

`src/index.ts` is the only public surface. It may import `client`, `react`, and `domain`.

| Export                    | Kind      | Role                                                                                  |
| ------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `createNotifiable`        | function  | Builds a client from config                                                           |
| `NotifiableConfig`        | type      | `publicKey`, optional `environment`, `baseUrl`, `logger`, `push`, `storage`, `device` |
| `NotifiableClient`        | type      | Config, start, permission, identify, snapshot                                         |
| `NotifiableBinding`       | type      | Hook value: config, snapshot, and commands                                            |
| `NotifiableSnapshot`      | type      | `ready`, `permission`, `subscriber`, `clientConfig`, `devIndicator`, `error`          |
| `DevIndicatorChoice`      | type      | `enabled` or `disabled` for the development mark                                      |
| `DeliveryConfig`          | type      | Client-config environment, app, and platform records                                  |
| `ClientApp`               | type      | App name, description, and icon                                                       |
| `ClientEnvironment`       | type      | `development` or `production` from client-config                                      |
| `PushPort`                | type      | App-supplied permission and token source                                              |
| `DevicePort`              | type      | Optional device profile override                                                      |
| `KeyValueStore`           | type      | Optional session storage                                                              |
| `Subscriber`              | type      | Subscriber returned by the API                                                        |
| `SubscriberNotification`  | type      | One inbox notification, including an optional delivery id                             |
| `IdentifyInput`           | type      | Email, external id, and name                                                          |
| `PermissionStatus`        | type      | `granted`, `denied`, `not_determined`                                                 |
| `PushProvider`            | type      | `apns`, `fcm`, `expo`, `web_push`                                                     |
| `NotifiableEnvironment`   | type      | `local` or `production`                                                               |
| `Logger`                  | type      | `debug`, `info`, `warn`, `error`                                                      |
| `NotifiableProvider`      | component | Builds or receives the client and starts it                                           |
| `NotifiableProviderProps` | type      | `client` or `publicKey`, plus children                                                |
| `useNotifiable`           | hook      | Live binding, or throws `missing_provider`                                            |
| `NotifiableError`         | class     | `Error` with a closed `code`                                                          |
| `notifiableErrorCodes`    | const     | Closed error codes                                                                    |
| `NotifiableErrorCode`     | type      | Union of those codes                                                                  |

`transport`, `platform`, and `internal` stay private. Branded ids (`PublicKey`, `UserId`, `DeviceId`) and `asPublicKey` stay private until a caller needs them.

## Layers

`domain` is innermost. `transport` and `platform` depend on `domain`. `client` composes them. `react` depends on `client`. ESLint enforces this with `no-restricted-imports`.

| Layer       | May import                                    | Must not import                                     |
| ----------- | --------------------------------------------- | --------------------------------------------------- |
| `domain`    | nothing in `src`                              | every other layer                                   |
| `transport` | `domain`                                      | `client`, `platform`, `react`, `internal`, `index`  |
| `platform`  | `domain`                                      | `client`, `transport`, `react`, `internal`, `index` |
| `internal`  | `domain`                                      | `client`, `transport`, `platform`, `react`, `index` |
| `client`    | `domain`, `transport`, `platform`, `internal` | `react`, `index`                                    |
| `react`     | `client`, `domain`                            | `transport`, `platform`, `internal`, `index`        |

Inside the package, use relative imports. Never import `@notifiable/react-native` from its own source.

## Adding behavior

1. Put models, branded ids, and error codes in `domain`. Add a code to `notifiableErrorCodes` before throwing it.
2. Put HTTP on `HttpClient` in `transport`. Put the push port and device profile on `platform`. Do not import Firebase, APNs, or Expo from this package.
3. Expose behavior on `NotifiableClient` and implement it in `NotifiableClientImpl`.
4. Touch `react` only for provider or hook changes.
5. Re-export from `src/index.ts` only if apps should call it.
6. Cover the public behavior in `src/**/*.test.ts`.

`react` and `react-native` are peer dependencies (`react` >= 18, `react-native` >= 0.73). `@react-native-async-storage/async-storage` is an optional peer. Do not add them as runtime dependencies.
