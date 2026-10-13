import { useState } from 'react';
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
  type PermissionStatus,
  type PushPort,
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

function defaultBaseUrl(): string {
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://127.0.0.1:8000/api';
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [publicKey, setPublicKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [connected, setConnected] = useState<{
    publicKey: string;
    baseUrl: string;
  } | null>(null);

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
        >
          <Home
            onDisconnect={() => {
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

function Home({ onDisconnect }: { onDisconnect: () => void }) {
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
