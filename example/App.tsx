import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  NotifiableProvider,
  useNotifiable,
  type DeepLink,
  type PermissionStatus,
  type PushPort,
  type SubscriberNotification,
} from '@notifiable/react-native';

const permission: { current: PermissionStatus } = {
  current: 'not_determined',
};

const push: PushPort = {
  provider: 'fcm',
  getPermissionStatus: () => Promise.resolve(permission.current),
  requestPermission: () =>
    new Promise(resolve => {
      Alert.alert(
        'Notifications',
        'Allow this example to register a device token?',
        [
          {
            text: 'Deny',
            style: 'cancel',
            onPress: () => {
              permission.current = 'denied';
              resolve('denied');
            },
          },
          {
            text: 'Allow',
            onPress: () => {
              permission.current = 'granted';
              resolve('granted');
            },
          },
        ],
        { cancelable: false },
      );
    }),
  getToken: () =>
    Promise.resolve(
      permission.current === 'granted' ? 'example-device-token' : null,
    ),
};

type ExamplePage = 'subscriber' | 'about' | 'delivery' | 'inbox';

const pages: readonly {
  id: Exclude<ExamplePage, 'subscriber'>;
  path: string;
  label: string;
  body: string;
}[] = [
  {
    id: 'about',
    path: '/about',
    label: 'About Notifiable',
    body: 'Notifiable registers this device and delivers notifications to people who accept them. This page is one of the routes the SDK sends when connect succeeds.',
  },
  {
    id: 'delivery',
    path: '/delivery',
    label: 'Delivery',
    body: 'A development key does not send a real push. The SDK shows a recent unread notification at the top of the screen.',
  },
  {
    id: 'inbox',
    path: '/inbox',
    label: 'Inbox',
    body: 'Opening a notification records that open. A tap records a click when the notification includes a delivery id.',
  },
];

const deepLinks: readonly DeepLink[] = pages.map(page => ({
  path: page.path,
  label: page.label,
}));

function defaultBaseUrl(): string {
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://127.0.0.1:8000/api';
}

function pageFor(url: string): ExamplePage | null {
  let pathname = url.split('?')[0] ?? url;

  if (pathname.includes('://')) {
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
  }

  const match = pages.find(page => page.path === pathname);

  return match === undefined ? null : match.id;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [publicKey, setPublicKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [page, setPage] = useState<ExamplePage>('subscriber');
  const [connected, setConnected] = useState<{
    publicKey: string;
    baseUrl: string;
  } | null>(null);
  const openDeepLink = useCallback((url: string) => {
    const next = pageFor(url);

    if (next !== null) {
      setPage(next);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {connected === null ? (
        <ConnectScreen
          publicKey={publicKey}
          baseUrl={baseUrl}
          onChangePublicKey={setPublicKey}
          onChangeBaseUrl={setBaseUrl}
          onConnect={() => {
            const key = publicKey.trim();
            const url = baseUrl.trim();

            if (key.length === 0 || url.length === 0) {
              return;
            }

            setConnected({ publicKey: key, baseUrl: url });
          }}
        />
      ) : (
        <NotifiableProvider
          publicKey={connected.publicKey}
          environment="local"
          baseUrl={connected.baseUrl}
          push={push}
          deepLinks={deepLinks}
          onDeepLink={openDeepLink}
        >
          <Connected
            page={page}
            onOpen={setPage}
            onDisconnect={() => {
              setPage('subscriber');
              setConnected(null);
            }}
          />
        </NotifiableProvider>
      )}
    </SafeAreaProvider>
  );
}

function ConnectScreen({
  publicKey,
  baseUrl,
  onChangePublicKey,
  onChangeBaseUrl,
  onConnect,
}: {
  publicKey: string;
  baseUrl: string;
  onChangePublicKey: (value: string) => void;
  onChangeBaseUrl: (value: string) => void;
  onConnect: () => void;
}) {
  const insets = useSafeAreaInsets();
  const canConnect = publicKey.trim().length > 0 && baseUrl.trim().length > 0;

  useEffect(() => {
    console.log('publicKey', publicKey);
    console.log('baseUrl', baseUrl);
    console.log('canConnect', canConnect);
  }, [publicKey, baseUrl, canConnect]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Notifiable</Text>
      <Text style={styles.subtitle}>
        This app uses the local @notifiable/react-native package. On the iOS
        simulator, 127.0.0.1 reaches your machine. On the Android emulator, use
        10.0.2.2.
      </Text>
      <Field
        label="Public key"
        value={publicKey}
        onChangeText={onChangePublicKey}
        placeholder="ntf_pub_..."
        autoCapitalize="none"
      />
      <Field
        label="API base URL"
        value={baseUrl}
        onChangeText={onChangeBaseUrl}
        placeholder="http://127.0.0.1:8000/api"
        autoCapitalize="none"
      />
      <Action label="Connect" onPress={onConnect} disabled={!canConnect} />
    </ScrollView>
  );
}

function Connected({
  page,
  onOpen,
  onDisconnect,
}: {
  page: ExamplePage;
  onOpen: (page: ExamplePage) => void;
  onDisconnect: () => void;
}) {
  const current = pages.find(item => item.id === page);

  if (page === 'inbox') {
    return (
      <InboxScreen
        onBack={() => {
          onOpen('subscriber');
        }}
      />
    );
  }

  if (current !== undefined) {
    return (
      <InfoPage
        title={current.label}
        path={current.path}
        body={current.body}
        onBack={() => {
          onOpen('subscriber');
        }}
      />
    );
  }

  return <Home onDisconnect={onDisconnect} onOpen={onOpen} />;
}

function InboxScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const notifiable = useNotifiable();
  const loadInbox = notifiable.inbox;
  const openNotification = notifiable.openNotification;
  const [pageNumber, setPageNumber] = useState(1);
  const [items, setItems] = useState<readonly SubscriberNotification[]>([]);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadInbox({ page: pageNumber })
      .then(result => {
        if (cancelled) {
          return;
        }

        setItems(result.notifications);
        setPerPage(result.perPage);
        setTotal(result.total);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : 'The inbox could not be loaded.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [loadInbox, pageNumber]);

  const hasNext = pageNumber * perPage < total;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>Inbox</Text>
      <Text style={styles.value}>/inbox</Text>
      {error !== null ? <Text style={styles.subtitle}>{error}</Text> : null}
      {items.length === 0 && error === null ? (
        <Text style={styles.subtitle}>No notifications yet.</Text>
      ) : null}
      {items.map(item => (
        <Pressable
          key={item.id}
          onPress={() => {
            void openNotification(item.id);
          }}
        >
          <Text style={styles.label}>{item.title}</Text>
          <Text style={styles.value}>{item.body}</Text>
        </Pressable>
      ))}
      {pageNumber > 1 ? (
        <Action
          label="Previous page"
          disabled={false}
          onPress={() => {
            setPageNumber(current => current - 1);
          }}
        />
      ) : null}
      {hasNext ? (
        <Action
          label="Next page"
          disabled={false}
          onPress={() => {
            setPageNumber(current => current + 1);
          }}
        />
      ) : null}
      <Action label="Back" onPress={onBack} disabled={false} />
    </ScrollView>
  );
}

function InfoPage({
  title,
  path,
  body,
  onBack,
}: {
  title: string;
  path: string;
  body: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{path}</Text>
      <Text style={styles.subtitle}>{body}</Text>
      <Action label="Back" onPress={onBack} disabled={false} />
    </ScrollView>
  );
}

function Home({
  onDisconnect,
  onOpen,
}: {
  onDisconnect: () => void;
  onOpen: (page: ExamplePage) => void;
}) {
  const insets = useSafeAreaInsets();
  const notifiable = useNotifiable();
  const [email, setEmail] = useState('');
  const [externalId, setExternalId] = useState('');
  const [busy, setBusy] = useState(false);
  const subscriber = notifiable.subscriber;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);

    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Subscriber</Text>
      <Status label="Base URL" value={notifiable.config.baseUrl ?? ''} />
      <Status label="Ready" value={notifiable.ready ? 'yes' : 'no'} />
      <Status label="Permission" value={notifiable.permission} />
      <Status label="Subscriber" value={subscriber?.id ?? 'waiting'} />
      <Status label="Anonymous id" value={subscriber?.anonymousId ?? 'none'} />
      <Status
        label="Deep links"
        value={
          notifiable.deepLinks === null
            ? 'waiting'
            : notifiable.deepLinks.map(link => link.path).join(', ')
        }
      />
      <Status
        label="Error"
        value={
          notifiable.error === null
            ? 'none'
            : `${notifiable.error.code}: ${notifiable.error.message}`
        }
      />
      {busy ? <ActivityIndicator /> : null}
      <Action
        label="Request permission"
        disabled={busy}
        onPress={() => {
          void run(() => notifiable.requestPermission());
        }}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="ada@example.com"
        autoCapitalize="none"
      />
      <Field
        label="External id"
        value={externalId}
        onChangeText={setExternalId}
        placeholder="user_123"
        autoCapitalize="none"
      />
      <Action
        label="Identify"
        disabled={busy || email.trim().length === 0}
        onPress={() => {
          const id = externalId.trim();
          void run(() =>
            notifiable.identify({
              email,
              ...(id.length > 0 ? { externalId: id } : {}),
            }),
          );
        }}
      />
      <Action
        label="Track order shipped"
        disabled={busy || subscriber === null}
        onPress={() => {
          void run(() => notifiable.track('order.shipped', { order: '1001' }));
        }}
      />
      <Action
        label="Report sample errors"
        disabled={busy || !notifiable.ready}
        onPress={() => {
          void run(async () => {
            const attempts = [
              () => notifiable.identify({ email: ' ' }),
              () => notifiable.identify({ externalId: ' ' }),
              () => notifiable.identify({}),
              () =>
                notifiable.notification('00000000-0000-4000-8000-000000000001'),
            ];

            for (const attempt of attempts) {
              try {
                await attempt();
              } catch {
                // These failures are expected. The SDK reports each one.
              }
            }
          });
        }}
      />
      {pages.map(page => (
        <Action
          key={page.path}
          label={page.label}
          disabled={busy}
          onPress={() => {
            onOpen(page.id);
          }}
        />
      ))}
      <Action label="Disconnect" onPress={onDisconnect} disabled={busy} />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize: 'none';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  field: {
    gap: 6,
  },
  status: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
