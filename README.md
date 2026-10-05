# @notifiable/react-native

React Native SDK for [Notifiable](https://notifiable.sh).

```bash
npm install @notifiable/react-native
```

This package is the library skeleton. Push registration, HTTP calls, and notification handling are not implemented yet.

## Layout

```text
src/
  index.ts        public exports only
  client/         createNotifiable() and the client interface
  domain/         models, branded ids, typed errors
  transport/      HttpClient interface
  platform/       device and token adapter interface
  react/          provider, context, and hooks
  internal/       logger and asserts, not re-exported
```

Consumers import from `@notifiable/react-native`. Deep imports are not part of the public API.

`domain` is the innermost layer. `transport` and `platform` depend on `domain`. `client` composes those layers. `react` depends on `client`. `src/index.ts` re-exports the public surface.
