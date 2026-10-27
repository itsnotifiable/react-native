import { asNotifiableError, NotifiableError } from "../domain/errors";
import { resolveLogger } from "../internal/logger";
import { createId } from "../internal/id";
import { loadDevIndicator, saveDevIndicator } from "../internal/dev-indicator";
import { loadDiagnostics, saveDiagnostics } from "../internal/diagnostics";
import { createUlid } from "../internal/ulid";
import { loadSession, saveSession } from "../internal/session";
import { loadDefaultStorage } from "../internal/storage";
import type { DeepLink } from "../domain/deep-link";
import type { DevIndicatorChoice } from "../domain/dev-indicator";
import {
  crashFingerprint,
  describeCrash,
  diagnosticSubscriberId,
  sdkVersion,
  type DiagnosticCrash,
  type DiagnosticsChoice,
  type StackFrame,
} from "../domain/diagnostic";
import type { EventProperty, RecordedEvent } from "../domain/event";
import type {
  InboxPage,
  InboxQuery,
  SubscriberNotification,
} from "../domain/inbox";
import type { Logger } from "../domain/logger";
import { localeParts } from "../domain/locale";
import type { KeyValueStore } from "../domain/storage";
import {
  pushProviderForPlatform,
  type DeliveryConfig,
  type IdentifyInput,
  type PermissionStatus,
  type MobilePlatform,
  type PushProvider,
  type StoredSession,
  type Subscriber,
  type SubscriberIdentity,
  type SubscriberWrite,
} from "../domain/subscriber";
import type { DevicePort } from "../platform/types";
import type { SdkApi } from "../transport/sdk-api";
import type {
  NotifiableClient,
  NotifiableConfig,
  NotifiableSnapshot,
} from "./types";

const initialSnapshot: NotifiableSnapshot = {
  ready: false,
  permission: "not_determined",
  subscriber: null,
  clientConfig: null,
  devIndicator: null,
  diagnostics: null,
  deepLinks: null,
  error: null,
};

export class NotifiableClientImpl implements NotifiableClient {
  readonly config: NotifiableConfig;
  readonly #api: SdkApi;
  readonly #device: DevicePort;
  readonly #logger: Logger;
  readonly #listeners = new Set<() => void>();
  #storage: KeyValueStore | undefined;
  #session: StoredSession | null = null;
  #diagnostics: DiagnosticsChoice | null = null;
  #diagnosticQueue: PendingDiagnostic[] = [];
  #diagnosticSeen = new Set<string>();
  #diagnosticFlushing = false;
  #snapshot: NotifiableSnapshot = initialSnapshot;
  #tail: Promise<void> = Promise.resolve();

  constructor(
    config: NotifiableConfig,
    api: SdkApi,
    device: DevicePort,
    storage: KeyValueStore | undefined,
  ) {
    this.config = config;
    this.#api = api;
    this.#device = device;
    this.#storage = storage;
    this.#logger = resolveLogger(config.logger);
    this.#logger.debug("Notifiable client created", {
      hasPush: config.push !== undefined,
    });
  }

  readonly start = (): Promise<void> => this.#enqueue(() => this.#start());

  readonly requestPermission = (): Promise<PermissionStatus> =>
    this.#enqueue(async () => {
      await this.#start();
      return this.#requestPermission();
    });

  readonly identify = (input: IdentifyInput): Promise<Subscriber> =>
    this.#enqueue(async () => {
      await this.#start();
      return this.#identify(input);
    });

  readonly setDevIndicator = (enabled: boolean): Promise<void> =>
    this.#setDevIndicator(enabled);

  readonly setDiagnostics = (enabled: boolean): Promise<void> =>
    this.#setDiagnostics(enabled);

  readonly listNotifications = (
    subscriberId: string,
    query?: InboxQuery,
  ): Promise<InboxPage> =>
    this.#capture(() =>
      query === undefined
        ? this.#api.listNotifications(subscriberId)
        : this.#api.listNotifications(subscriberId, query),
    );

  readonly inbox = (query?: InboxQuery): Promise<InboxPage> =>
    this.#capture(() => {
      const subscriberId = this.#requireSubscriberId();

      return query === undefined
        ? this.#api.listNotifications(subscriberId)
        : this.#api.listNotifications(subscriberId, query);
    });

  readonly notification = (
    notificationId: string,
  ): Promise<SubscriberNotification> =>
    this.#capture(() =>
      this.#api.getNotification(this.#requireSubscriberId(), notificationId),
    );

  readonly openNotification = (
    subscriberId: string,
    notificationId: string,
  ): Promise<void> =>
    this.#capture(() =>
      this.#api.openNotification(subscriberId, notificationId),
    );

  readonly openStoredNotification = (notificationId: string): Promise<void> =>
    this.#capture(() =>
      this.#api.openNotification(this.#requireSubscriberId(), notificationId),
    );

  readonly clickDelivery = (deliveryId: string): Promise<void> =>
    this.#capture(() => this.#api.clickDelivery(deliveryId));

  readonly track = (
    name: string,
    properties?: Readonly<Record<string, EventProperty>>,
  ): Promise<RecordedEvent> =>
    this.#capture(() => {
      const subscriberId = this.#requireSubscriberId();

      return properties === undefined
        ? this.#api.trackEvent(subscriberId, name)
        : this.#api.trackEvent(subscriberId, name, properties);
    });

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): NotifiableSnapshot => this.#snapshot;

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#tail = this.#tail.then(
        () => runQueued(task, resolve, reject),
        () => runQueued(task, resolve, reject),
      );
    });
  }

  async #start(): Promise<void> {
    if (this.#snapshot.ready) {
      return;
    }

    await this.#guard(async () => {
      const storage = await this.#resolveStorage();
      const existing = await loadSession(storage, this.config.publicKey);
      const session = existing ?? {
        deviceId: createId(),
        subscriberId: null,
        pushToken: null,
        anonymousId: null,
      };

      if (existing === null) {
        await saveSession(storage, this.config.publicKey, session);
      }

      this.#session = session;
      const devIndicator = await loadDevIndicator(
        storage,
        this.config.publicKey,
      );
      const diagnostics = await loadDiagnostics(storage, this.config.publicKey);
      this.#diagnostics = diagnostics;
      const clientConfig = await this.#api.getClientConfig();
      this.#commit({ clientConfig, devIndicator, diagnostics });
      await this.#syncDevice({ prompted: false });
      await this.#saveDeepLinks();
      await this.#promptIfRequested();
    });
  }

  async #promptIfRequested(): Promise<void> {
    if (
      this.#snapshot.subscriber?.promptPermission !== true ||
      this.config.push === undefined
    ) {
      return;
    }

    this.#logger.info("Permission prompt requested");
    // Dashboard prompts must clear even when a token cannot be created
    // (Expo Go / missing FCM). Explicit requestPermission still throws.
    await this.#requestPermission({ softMissingToken: true });
  }

  async #requestPermission(
    options: { readonly softMissingToken?: boolean } = {},
  ): Promise<PermissionStatus> {
    return this.#guard(async () => {
      const push = this.config.push;

      if (push === undefined) {
        throw new NotifiableError({
          code: "invalid_config",
          message: "push is required to request permission.",
        });
      }

      let permission: PermissionStatus;

      try {
        permission = await push.requestPermission();
      } catch (error) {
        const wrapped = asNotifiableError(error);

        if (
          options.softMissingToken === true &&
          wrapped.code === "missing_token"
        ) {
          await this.#syncDevice({
            prompted: true,
            permission: "not_determined",
          });
          return this.#snapshot.permission;
        }

        throw wrapped;
      }

      await this.#syncDevice({ prompted: true, permission });
      return this.#snapshot.permission;
    });
  }

  async #identify(input: IdentifyInput): Promise<Subscriber> {
    return this.#guard(async () => {
      const session = this.#requireSession();

      if (session.subscriberId === null) {
        throw new NotifiableError({
          code: "subscriber_not_found",
          message: "The subscriber is not registered yet.",
        });
      }

      const identity = identityFrom(input);
      const subscriber = await this.#api.updateSubscriber(
        session.subscriberId,
        identity,
      );
      const storage = await this.#resolveStorage();
      const nextSession: StoredSession = {
        deviceId: session.deviceId,
        subscriberId: subscriber.id,
        pushToken: session.pushToken,
        anonymousId: subscriber.anonymousId,
      };

      await saveSession(storage, this.config.publicKey, nextSession);
      this.#session = nextSession;
      this.#commit({ subscriber, error: null });
      this.#logger.info("Subscriber identified", {
        subscriberId: subscriber.id,
      });
      return subscriber;
    });
  }

  async #syncDevice(options: {
    readonly prompted: boolean;
    readonly permission?: PermissionStatus;
  }): Promise<void> {
    let session = this.#requireSession();

    if (session.subscriberId === null && session.anonymousId === null) {
      session = { ...session, anonymousId: createId() };
      const storage = await this.#resolveStorage();
      await saveSession(storage, this.config.publicKey, session);
      this.#session = session;
    }

    const profile = await this.#device.getProfile();
    const permission = options.permission ?? (await this.#currentPermission());
    const token = await this.#tokenFor(permission, profile.platform);
    // The API rejects granted unless provider and token are present.
    const savedPermission =
      token === null && permission === "granted" ? "not_determined" : permission;
    const anonymousId =
      session.subscriberId === null
        ? (session.anonymousId ?? undefined)
        : undefined;
    const place = localeParts(profile.locale);
    const write: SubscriberWrite = {
      deviceId: session.deviceId,
      platform: profile.platform,
      permission: savedPermission,
      sdkVersion,
      ...(token !== null
        ? { token: token.token, provider: token.provider }
        : {}),
      ...(anonymousId !== undefined ? { anonymousId } : {}),
      ...(options.prompted ? { prompted: true } : {}),
      ...(profile.osVersion !== null ? { osVersion: profile.osVersion } : {}),
      ...(profile.locale !== null ? { locale: profile.locale } : {}),
      ...(profile.timezone !== null ? { timezone: profile.timezone } : {}),
      ...(profile.model !== null ? { model: profile.model } : {}),
      ...(profile.manufacturer !== null
        ? { manufacturer: profile.manufacturer }
        : {}),
      ...(profile.appVersion !== null
        ? { appVersion: profile.appVersion }
        : {}),
      ...(profile.ip !== null ? { ip: profile.ip } : {}),
      ...(place.language !== null ? { language: place.language } : {}),
      ...(place.countryCode !== null ? { countryCode: place.countryCode } : {}),
    };
    const subscriber = await this.#api.saveSubscriber(write);
    const storage = await this.#resolveStorage();
    const nextSession: StoredSession = {
      deviceId: session.deviceId,
      subscriberId: subscriber.id,
      pushToken: token?.token ?? null,
      anonymousId: subscriber.anonymousId,
    };

    await saveSession(storage, this.config.publicKey, nextSession);
    this.#session = nextSession;
    this.#commit({
      ready: true,
      permission: savedPermission,
      subscriber,
      error: null,
    });
    this.#logger.info("Subscriber saved", {
      subscriberId: subscriber.id,
      permission: savedPermission,
    });
  }

  async #currentPermission(): Promise<PermissionStatus> {
    const push = this.config.push;

    if (push?.getPermissionStatus === undefined) {
      return "not_determined";
    }

    return push.getPermissionStatus();
  }

  async #tokenFor(
    permission: PermissionStatus,
    platform: MobilePlatform,
  ): Promise<{
    readonly token: string;
    readonly provider: PushProvider;
  } | null> {
    if (permission !== "granted") {
      return null;
    }

    const push = this.config.push;

    if (push === undefined) {
      throw new NotifiableError({
        code: "missing_token",
        message: "Push permission is granted, but no push port is configured.",
      });
    }

    const token = (await push.getToken())?.trim() ?? "";

    if (token.length === 0) {
      if (push.allowMissingToken === true) {
        return null;
      }

      throw new NotifiableError({
        code: "missing_token",
        message:
          "Push permission is granted, but no device token was returned.",
      });
    }

    const provider = push.provider ?? pushProviderForPlatform(platform);

    return { token, provider };
  }

  async #saveDeepLinks(): Promise<void> {
    const links = this.config.deepLinks;

    if (links === undefined) {
      return;
    }

    const saved = await this.#api.saveDeepLinks(links);
    this.#commit({ deepLinks: saved });
    this.#logger.info("Deep links saved", { count: saved.length });
  }

  async #setDiagnostics(enabled: boolean): Promise<void> {
    const storage = await this.#resolveStorage();
    const diagnostics: DiagnosticsChoice = enabled ? "enabled" : "disabled";
    await saveDiagnostics(storage, this.config.publicKey, diagnostics);
    this.#diagnostics = diagnostics;
    this.#commit({ diagnostics });

    if (!enabled) {
      this.#diagnosticQueue = [];
    }
  }

  async #setDevIndicator(enabled: boolean): Promise<void> {
    const storage = await this.#resolveStorage();
    const devIndicator: DevIndicatorChoice = enabled ? "enabled" : "disabled";
    await saveDevIndicator(storage, this.config.publicKey, devIndicator);
    this.#commit({ devIndicator });
  }

  async #resolveStorage(): Promise<KeyValueStore> {
    if (this.#storage !== undefined) {
      return this.#storage;
    }

    const storage = await loadDefaultStorage();
    this.#storage = storage;
    return storage;
  }

  #requireSession(): StoredSession {
    if (this.#session === null) {
      throw new NotifiableError({
        code: "subscriber_not_found",
        message: "The subscriber is not registered yet.",
      });
    }

    return this.#session;
  }

  #requireSubscriberId(): string {
    const subscriberId = this.#requireSession().subscriberId;

    if (subscriberId === null) {
      throw new NotifiableError({
        code: "subscriber_not_found",
        message: "The subscriber is not registered yet.",
      });
    }

    return subscriberId;
  }

  async #guard<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      this.#report(error);
      const wrapped = asNotifiableError(error);
      this.#commit({ error: wrapped });
      throw wrapped;
    }
  }

  #capture<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let pending: Promise<T>;

      try {
        pending = task();
      } catch (error) {
        this.#report(error);
        reject(asNotifiableError(error));
        return;
      }

      // Throw inside this rejection handler makes Hermes report the poll
      // failure as uncaught, even when the caller catches it.
      pending.then(
        (value) => {
          resolve(value);
        },
        (error: unknown) => {
          this.#report(error);
          reject(asNotifiableError(error));
        },
      );
    });
  }

  #diagnosticsOpen(): boolean {
    return (
      this.#snapshot.clientConfig?.environment === "development" &&
      this.#diagnostics !== "disabled"
    );
  }

  #report(error: unknown): void {
    if (!this.#diagnosticsOpen()) {
      return;
    }

    const described = describeCrash(error);
    const fingerprint = crashFingerprint(
      described.type,
      described.message,
      described.frames,
    );

    if (this.#diagnosticSeen.has(fingerprint)) {
      return;
    }

    this.#diagnosticSeen.add(fingerprint);
    const subscriberId = diagnosticSubscriberId(
      this.#session?.subscriberId ?? null,
    );
    this.#diagnosticQueue.push({
      id: createUlid(),
      occurredAt: new Date().toISOString(),
      type: described.type,
      message: described.message,
      frames: described.frames,
      ...(subscriberId !== undefined ? { subscriberId } : {}),
    });

    if (this.#diagnosticQueue.length > 20) {
      this.#diagnosticQueue.shift();
    }

    void Promise.resolve().then(() => {
      void this.#flushDiagnostics();
    });
  }

  async #flushDiagnostics(): Promise<void> {
    if (this.#diagnosticFlushing || this.#diagnosticQueue.length === 0) {
      return;
    }

    if (!this.#diagnosticsOpen()) {
      this.#diagnosticQueue = [];
      return;
    }

    this.#diagnosticFlushing = true;
    const batch = this.#diagnosticQueue.splice(0, 20);

    try {
      const profile = await this.#device.getProfile();

      if (!this.#diagnosticsOpen()) {
        return;
      }

      await this.#api.reportDiagnostics(
        batch.map((item) => diagnosticCrash(item, profile.platform)),
      );
    } catch {
      return;
    } finally {
      this.#diagnosticFlushing = false;
    }

    if (this.#diagnosticQueue.length > 0) {
      void Promise.resolve().then(() => {
        void this.#flushDiagnostics();
      });
    }
  }

  #commit(patch: {
    readonly ready?: boolean;
    readonly permission?: PermissionStatus;
    readonly subscriber?: Subscriber | null;
    readonly clientConfig?: DeliveryConfig | null;
    readonly devIndicator?: DevIndicatorChoice | null;
    readonly diagnostics?: DiagnosticsChoice | null;
    readonly deepLinks?: readonly DeepLink[] | null;
    readonly error?: NotifiableError | null;
  }): void {
    this.#snapshot = {
      ready: patch.ready !== undefined ? patch.ready : this.#snapshot.ready,
      permission:
        patch.permission !== undefined
          ? patch.permission
          : this.#snapshot.permission,
      subscriber:
        patch.subscriber !== undefined
          ? patch.subscriber
          : this.#snapshot.subscriber,
      clientConfig:
        patch.clientConfig !== undefined
          ? patch.clientConfig
          : this.#snapshot.clientConfig,
      devIndicator:
        patch.devIndicator !== undefined
          ? patch.devIndicator
          : this.#snapshot.devIndicator,
      diagnostics:
        patch.diagnostics !== undefined
          ? patch.diagnostics
          : this.#snapshot.diagnostics,
      deepLinks:
        patch.deepLinks !== undefined
          ? patch.deepLinks
          : this.#snapshot.deepLinks,
      error: patch.error !== undefined ? patch.error : this.#snapshot.error,
    };

    for (const listener of this.#listeners) {
      listener();
    }
  }
}

interface PendingDiagnostic {
  readonly id: string;
  readonly occurredAt: string;
  readonly type: string;
  readonly message: string;
  readonly frames: readonly StackFrame[];
  readonly subscriberId?: string;
}

function diagnosticCrash(
  item: PendingDiagnostic,
  platform: MobilePlatform,
): DiagnosticCrash {
  return {
    id: item.id,
    kind: "crash",
    sdk: "react-native",
    sdkVersion,
    platform,
    occurredAt: item.occurredAt,
    error: {
      type: item.type,
      message: item.message,
      frames: item.frames,
    },
    ...(item.subscriberId !== undefined
      ? { subscriberId: item.subscriberId }
      : {}),
  };
}

function runQueued<T>(
  task: () => Promise<T>,
  resolve: (value: T) => void,
  reject: (error: unknown) => void,
): Promise<void> {
  let pending: Promise<T>;

  try {
    pending = task();
  } catch (error) {
    reject(error);
    return Promise.resolve();
  }

  // Attach the handler here. Returning the task promise from `.then` leaves
  // Hermes reporting that rejection as uncaught, which opens the redbox.
  return pending.then(
    (value) => {
      resolve(value);
    },
    (error: unknown) => {
      reject(error);
    },
  );
}

function identityFrom(input: IdentifyInput): SubscriberIdentity {
  const identity: {
    email?: string;
    externalId?: string;
    firstName?: string | null;
    lastName?: string | null;
    anonymousId?: null;
  } = {};

  if (input.email !== undefined) {
    const email = input.email.trim();

    if (email.length === 0) {
      throw new NotifiableError({
        code: "invalid_config",
        message: "email cannot be blank.",
      });
    }

    identity.email = email;
  }

  if (input.externalId !== undefined) {
    const externalId = input.externalId.trim();

    if (externalId.length === 0) {
      throw new NotifiableError({
        code: "invalid_config",
        message: "externalId cannot be blank.",
      });
    }

    identity.externalId = externalId;
  }

  if (input.firstName !== undefined) {
    identity.firstName = input.firstName;
  }

  if (input.lastName !== undefined) {
    identity.lastName = input.lastName;
  }

  if (
    identity.email === undefined &&
    identity.externalId === undefined &&
    identity.firstName === undefined &&
    identity.lastName === undefined
  ) {
    throw new NotifiableError({
      code: "invalid_config",
      message:
        "identify requires an email, externalId, firstName, or lastName.",
    });
  }

  if (identity.email !== undefined || identity.externalId !== undefined) {
    identity.anonymousId = null;
  }

  return identity;
}
