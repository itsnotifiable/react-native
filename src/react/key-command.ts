import { useEffect, useRef } from "react";
import { NativeEventEmitter, NativeModules, Platform } from "react-native";

type KeyCommandModule = {
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
};

const eventName = "notifiableShowMark";

export function showMarkShortcut(): string | null {
  return Platform.OS === "ios" ? "⌘N" : null;
}

export function useShowMarkShortcut(onShow: () => void): void {
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;

  useEffect(() => {
    return subscribeShowMark(() => {
      onShowRef.current();
    });
  }, []);
}

function subscribeShowMark(listener: () => void): () => void {
  const native = readKeyCommandModule();

  if (native === null) {
    return () => undefined;
  }

  const emitter = new NativeEventEmitter(native);
  const subscription = emitter.addListener(eventName, listener);

  return () => {
    subscription.remove();
  };
}

function readKeyCommandModule(): KeyCommandModule | null {
  const modules: unknown = NativeModules;

  if (typeof modules !== "object" || modules === null) {
    return null;
  }

  const native: unknown = Reflect.get(modules, "NotifiableKeyCommand");

  if (!isNativeModule(native)) {
    return null;
  }

  return native;
}

function isNativeModule(value: unknown): value is KeyCommandModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "addListener" in value &&
    "removeListeners" in value
  );
}
