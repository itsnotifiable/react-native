import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

function passthrough({ children }: { readonly children?: ReactNode }) {
  return createElement("div", null, children);
}

vi.mock("react-native", () => ({
  View: passthrough,
  Text: passthrough,
  Pressable: passthrough,
  Image: () => null,
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  PanResponder: {
    create: () => ({ panHandlers: {} }),
  },
  Animated: {
    View: passthrough,
    ValueXY: class ValueXY {
      x = 0;
      y = 0;
      constructor(value?: { x: number; y: number }) {
        this.x = value?.x ?? 0;
        this.y = value?.y ?? 0;
      }
      setValue(value: { x: number; y: number }): void {
        this.x = value.x;
        this.y = value.y;
      }
      stopAnimation(): void {
        return undefined;
      }
    },
    Value: class Value {
      setValue(): void {
        return undefined;
      }
      interpolate(): number {
        return 0;
      }
    },
    spring: () => ({
      start: () => undefined,
    }),
    timing: () => ({
      start: (callback?: (result: { finished: boolean }) => void) => {
        callback?.({ finished: true });
      },
      stop: () => undefined,
    }),
  },
  AppState: {
    currentState: "active",
    addEventListener: () => ({
      remove: () => undefined,
    }),
  },
  useWindowDimensions: () => ({
    width: 390,
    height: 844,
    scale: 2,
    fontScale: 1,
  }),
}));
