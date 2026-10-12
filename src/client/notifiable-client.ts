import { asNotifiableError, NotifiableError } from "../domain/errors";
import { resolveLogger } from "../internal/logger";
import { createId } from "../internal/id";
import { loadSession, saveSession } from "../internal/session";
import { loadDefaultStorage } from "../internal/storage";
import type { Logger } from "../domain/logger";
import type { KeyValueStore } from "../domain/storage";
import type {
  IdentifyInput,
  PermissionStatus,
  PushProvider,
  StoredSession,
  Subscriber,
  SubscriberIdentity,
  SubscriberWrite,
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
      environment: config.environment,
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

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): NotifiableSnapshot => this.#snapshot;

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(task, task);
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
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
      await this.#api.getClientConfig();
      await this.#syncDevice({ prompted: false });
    });
  }

  async #requestPermission(): Promise<PermissionStatus> {
    return this.#guard(async () => {
      const push = this.config.push;

      if (push === undefined) {
        throw new NotifiableError({
          code: "invalid_config",
          message: "push is required to request permission.",
        });
      }

      const permission = await push.requestPermission();
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
    const token = await this.#tokenFor(permission);
    const anonymousId =
      session.subscriberId === null
        ? (session.anonymousId ?? undefined)
        : undefined;
    const write: SubscriberWrite = {
      deviceId: session.deviceId,
      platform: profile.platform,
      permission,
      ...(token !== null
        ? { token: token.token, provider: token.provider }
        : {}),
      ...(anonymousId !== undefined ? { anonymousId } : {}),
      ...(options.prompted ? { prompted: true } : {}),
      ...(profile.osVersion !== null ? { osVersion: profile.osVersion } : {}),
      ...(profile.locale !== null ? { locale: profile.locale } : {}),
      ...(profile.timezone !== null ? { timezone: profile.timezone } : {}),
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
      permission,
      subscriber,
      error: null,
    });
    this.#logger.info("Subscriber saved", {
      subscriberId: subscriber.id,
      permission,
    });
  }

  async #currentPermission(): Promise<PermissionStatus> {
    const push = this.config.push;

    if (push?.getPermissionStatus === undefined) {
      return "not_determined";
    }

    return push.getPermissionStatus();
  }

  async #tokenFor(permission: PermissionStatus): Promise<{
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
      throw new NotifiableError({
        code: "missing_token",
        message:
          "Push permission is granted, but no device token was returned.",
      });
    }

    return { token, provider: push.provider };
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

  async #guard<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      const wrapped = asNotifiableError(error);
      this.#commit({ error: wrapped });
      throw wrapped;
    }
  }

  #commit(patch: {
    readonly ready?: boolean;
    readonly permission?: PermissionStatus;
    readonly subscriber?: Subscriber | null;
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
      error: patch.error !== undefined ? patch.error : this.#snapshot.error,
    };

    for (const listener of this.#listeners) {
      listener();
    }
  }
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
