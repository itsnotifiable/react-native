# @notifiable/react-native

Register a React Native app with [Notifiable](https://notifiable.sh): connect with a public key, ask for notification permission, identify the user, list their inbox, record opens and taps, and track events.

Import only from `@notifiable/react-native`. This package does not ship Firebase, APNs, or Expo — your app supplies a `push` port.

## Install

```bash
npm install @notifiable/react-native
npm install @react-native-async-storage/async-storage
```

Peers: `react` ≥ 18, `react-native` ≥ 0.73. AsyncStorage keeps the subscriber between launches. If the app already has a store, pass `storage` and skip AsyncStorage. Rebuild the native app after install so device info and the real bundle id / package name are available.

## Integrate

Wrap the app in `NotifiableProvider`. It connects on mount. Permission is asked only when you call `requestPermission()`, or when the Notifiable dashboard requests the prompt.

```tsx
import { NotifiableProvider, useNotifiable } from "@notifiable/react-native";

function App() {
  return (
    <NotifiableProvider
      publicKey="ntf_pub_..."
      push={{
        provider: "fcm",
        getPermissionStatus,
        requestPermission,
        getToken,
      }}
      deepLinks={[
        { path: "/orders", label: "Orders" },
        { path: "/inbox", label: "Inbox" },
      ]}
      onDeepLink={(url) => {
        // Open this route in your navigator.
      }}
    >
      <Home />
    </NotifiableProvider>
  );
}
```

| Prop | Required | Description |
| --- | --- | --- |
| `publicKey` | yes* | Key from the Notifiable dashboard. Use the **development** key while building; the **production** key in the store build. |
| `push` | yes* | How this app reads permission and the device token. |
| `deepLinks` | no | Routes Notifiable can link to: `{ path, label }`. Saved on connect. |
| `onDeepLink` | no | Called with a notification url (e.g. development toast tap). |
| `storage` | no | `{ getItem, setItem, removeItem }`. Defaults to AsyncStorage. |
| `logger` | no | `debug` / `info` / `warn` / `error` callbacks. |
| `client` | no | Existing client from `createNotifiable`. Ignores `publicKey`. |

\*Required unless you pass `client`.

### Push port

`provider` is `"apns"`, `"fcm"`, `"expo"`, or `"web_push"`.

```ts
const push = {
  provider: "fcm" as const,
  getPermissionStatus: () => Promise.resolve(status), // optional
  requestPermission: () => askTheOperatingSystem(),   // returns granted | denied | not_determined
  getToken: () => Promise.resolve(token),             // string or null
};
```

The token is saved only when permission is `granted` and `getToken()` returns a string. Otherwise you get `missing_token` and the grant is not registered.

### Permission

```tsx
function EnableNotifications() {
  const { requestPermission } = useNotifiable();
  return (
    <Button title="Enable notifications" onPress={() => void requestPermission()} />
  );
}
```

Or ask from the Notifiable dashboard: the next connect opens the system prompt automatically.

## useNotifiable

Call under `NotifiableProvider`. Throws `missing_provider` outside that tree. Wait until `ready` is true before `identify`, `inbox`, `notification`, `openNotification`, `clickDelivery`, or `track`.

```tsx
const notifiable = useNotifiable();
if (!notifiable.ready) return <Text>Connecting…</Text>;
```

### State

| Field | Meaning |
| --- | --- |
| `ready` | Connect finished and the subscriber was saved. |
| `permission` | `"granted"` \| `"denied"` \| `"not_determined"` |
| `subscriber` | Device/person record, or `null` until connect. |
| `clientConfig` | Dashboard app record (`development` / `production`), or `null`. |
| `deepLinks` | Saved routes, or `null`. |
| `devIndicator` | `"enabled"` \| `"disabled"` \| `null` |
| `diagnostics` | `"enabled"` \| `"disabled"` \| `null` (missing ⇒ sharing on in development) |
| `error` | Last `NotifiableError`, or `null` |
| `config` | Options this client was created with |

### Methods

**`start()`** — Connects (or no-ops if already connected). The provider calls this on mount.

**`requestPermission()`** — Shows the system prompt via your `push` port, then saves. Returns the new permission.

**`identify(input)`** — Attach a signed-in user. Pass at least `email` or `externalId`.

```tsx
await notifiable.identify({
  email: "ada@example.com",
  externalId: "user_123",
  firstName: "Ada",
  lastName: "Lovelace",
});
```

**`inbox(query?)`** — One page of notifications (20 per page).

```tsx
const page = await notifiable.inbox();
const unread = await notifiable.inbox({ page: 1, opened: false });
// { notifications, page, perPage, total }
```

**`notification(id)`** — Load one notification by id.

**`openNotification(id)`** — Record that the subscriber opened it (e.g. inbox mark-as-read).

**`clickDelivery(deliveryId)`** — Record a tap. Use `notification.deliveryId` when navigating from your own inbox.

**`track(name, properties?)`** — Record an event for the connected subscriber (up to 20 keys; string / number / boolean / `null`).

```tsx
await notifiable.track("order.shipped", { order: "1001", express: true });
```

**`setDevIndicator(enabled)`** / **`setDiagnostics(enabled)`** — Control the development mark and crash sharing. No-ops for a production key.

### createNotifiable

Build a client when the provider should not create one, then pass it as `client`.

```tsx
import { createNotifiable, NotifiableProvider } from "@notifiable/react-native";

const client = createNotifiable({
  publicKey: "ntf_pub_...",
  push: { provider: "fcm", requestPermission, getToken },
});
```

## Development vs production

| | Development key | Production key |
| --- | --- | --- |
| First launch | Sheet to show/hide the Notifiable mark | No sheet |
| On screen | Draggable mark (bundle id / package check) | Nothing overlaid |
| Notifications | Dashboard sends appear as top toasts while foreground + granted | Your push provider displays them |
| Diagnostics | Failed SDK calls can be shared | Nothing sent |

Simulator tip: with a development key, send a notification from the dashboard to preview title, tap, and deep link without a physical device. On iOS simulator, **⌘N** shows the mark again.

## Errors

Failed calls throw `NotifiableError`. `error.code` on the hook matches the last failure.

| Code | Meaning |
| --- | --- |
| `invalid_config` | Blank public key, or permission without `push`. |
| `missing_provider` | `useNotifiable()` outside the provider. |
| `invalid_public_key` | Key rejected. |
| `network` | Request failed. |
| `validation_failed` | Rejected value (e.g. blank email). |
| `subscriber_not_found` | Connect not finished, or subscriber gone. |
| `subscriber_limit` | Project cannot add another subscriber. |
| `rate_limited` | Too many requests. |
| `missing_token` | Granted permission but empty token. |
| `missing_storage` | No AsyncStorage and no `storage` prop. |

## For AI agents

### Rules

1. Import only from `@notifiable/react-native`. Do not deep-import package internals.
2. Mount one `NotifiableProvider` around the navigator. Always pass `publicKey` and a real `push` port from the app’s existing push setup (FCM / APNs / etc.).
3. Call `useNotifiable()` only under that provider. Wait for `ready` before `identify`, `inbox`, `notification`, `openNotification`, `clickDelivery`, or `track`.
4. Call `requestPermission()` from a user action (button), not on every mount.
5. After sign-in, call `identify` with `email` and/or `externalId`.
6. Wire `onDeepLink` to the app’s navigator. Record `clickDelivery` yourself when handling taps from a custom inbox.
7. Use the development public key in debug builds and the production key in release builds. Do not invent hosts, env names, or CORS settings — the SDK talks to Notifiable for you.

### Integration prompt

Copy this into a coding agent when wiring the SDK into an existing React Native app:

```text
Integrate @notifiable/react-native into this React Native project.

1. Install @notifiable/react-native and @react-native-async-storage/async-storage if missing.
2. Find the app root / navigation root. Wrap it in NotifiableProvider from @notifiable/react-native.
3. Pass publicKey from the project’s env (development key for debug, production key for release).
4. Implement a push port from this app’s existing notification stack (provider: apns | fcm | expo | web_push) with requestPermission and getToken. Pass it as the push prop. Do not add Firebase/APNs/Expo libraries from the SDK — use what the app already has, or ask before adding new native deps.
5. Pass deepLinks for the main screens Notifiable should be able to open, and onDeepLink that navigates with this app’s router.
6. After the user signs in, call identify({ email, externalId }) once ready is true.
7. Add a clear “Enable notifications” button that calls requestPermission().
8. If the app has an inbox screen, use inbox(), openNotification(id), and clickDelivery(deliveryId) where appropriate.
9. Do not explain or configure CORS, API hosts, or environments — only the public key and push port. Keep changes minimal and match existing project patterns.
```
