# @notifiable/react-native

React Native SDK for [Notifiable](https://notifiable.sh).

```bash
npm install @notifiable/react-native
npm install @react-native-async-storage/async-storage
```

AsyncStorage is optional. Pass `storage` if the app already has another key-value store. Push tokens stay in the app: pass a `push` port for Firebase, APNs, or Expo. This package does not ship those native modules.

```tsx
import { NotifiableProvider, useNotifiable } from "@notifiable/react-native";

function App() {
  return (
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
      <Home />
    </NotifiableProvider>
  );
}

function Home() {
  const { permission, requestPermission, identify } = useNotifiable();

  return (
    <Button
      title={permission}
      onPress={() => {
        void requestPermission().then(() =>
          identify({ email: "ada@example.com", externalId: "user_123" }),
        );
      }}
    />
  );
}
```

`environment: "local"` calls `http://127.0.0.1:8000/api`. The default, `"production"`, calls `https://notifiable.sh/api`. `baseUrl` overrides either host.

The provider registers the install on startup. Permission can be denied or still undetermined. `requestPermission()` asks the push port, then updates the subscriber. `identify()` turns an anonymous subscriber into a known user.

The device stores the subscriber id, install id, and last push token. Notifiable does not return a subscriber secret.

## Layout

```text
src/
  index.ts        public exports only
  client/         createNotifiable() and registration
  domain/         models, hosts, branded ids, typed errors
  transport/      HTTP client and SDK routes
  platform/       push port and device profile
  react/          provider, context, and hooks
  internal/       session, ids, and logger
```

Consumers import from `@notifiable/react-native`. Deep imports are not part of the public API.

`domain` is the innermost layer. `transport` and `platform` depend on `domain`. `client` composes those layers. `react` depends on `client`. `src/index.ts` re-exports the public surface.
