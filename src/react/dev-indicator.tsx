import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Image,
  Linking,
  NativeModules,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { packageCheck, type PackageCheck } from "../domain/package-check";
import type { DeliveryConfig } from "../domain/subscriber";
import { showMarkShortcut, useShowMarkShortcut } from "./key-command";
import { useNotifiable } from "./use-notifiable";

const ringWidth = 6;
const markSize = 66;
const iconSize = markSize - ringWidth * 6;
const markIcon = "https://notifiable.sh/favicon.png";
const diagnosticsUrl = "https://notifiable.sh/sdk-diagnostics";
const sideGap = 20;
const topGap = 76;
const bottomGap = 56;

export function DevelopmentBadge({
  children,
  clientConfig,
}: {
  readonly children: ReactNode;
  readonly clientConfig: DeliveryConfig;
}): React.JSX.Element {
  const notifiable = useNotifiable();
  const devIndicator = notifiable.devIndicator;
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapMounted, setRecapMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const devIndicatorRef = useRef(devIndicator);
  const chooseRef = useRef<(enabled: boolean) => void>(() => undefined);
  devIndicatorRef.current = devIndicator;

  function choose(enabled: boolean): void {
    if (saving) {
      return;
    }

    setSaving(true);
    void notifiable.setDevIndicator(enabled).finally(() => {
      setSaving(false);
      setRecapOpen(false);
    });
  }

  chooseRef.current = choose;
  useShowMarkShortcut(() => {
    if (devIndicatorRef.current !== "enabled") {
      chooseRef.current(true);
    }
  });

  if (devIndicator === "disabled") {
    return <>{children}</>;
  }

  return (
    <View style={styles.host} pointerEvents="box-none">
      {children}
      {devIndicator === null ? (
        <IntroSheet
          clientConfig={clientConfig}
          saving={saving}
          onChoose={choose}
        />
      ) : null}
      {devIndicator === "enabled" ? (
        <DraggableMark
          onOpen={() => {
            setRecapMounted(true);
            setRecapOpen(true);
          }}
        />
      ) : null}
      {devIndicator === "enabled" && recapMounted ? (
        <RecapSheet
          clientConfig={clientConfig}
          open={recapOpen}
          saving={saving}
          onClose={() => {
            setRecapOpen(false);
          }}
          onExited={() => {
            setRecapMounted(false);
          }}
          onHide={() => {
            choose(false);
          }}
        />
      ) : null}
    </View>
  );
}

function IntroSheet({
  clientConfig,
  saving,
  onChoose,
}: {
  readonly clientConfig: DeliveryConfig;
  readonly saving: boolean;
  readonly onChoose: (enabled: boolean) => void;
}): React.JSX.Element {
  const name = clientConfig.app?.name ?? "this app";
  const shortcut = showMarkShortcut();

  return (
    <Sheet>
      <AppHeading clientConfig={clientConfig} />
      <Text style={styles.body}>
        Notifiable registers this device and delivers notifications to people
        who accept them. {name} is in development, so a mark can stay on screen
        while you test.
      </Text>
      <Text style={styles.body}>
        Drag it to the top, right, bottom, or left. It stays on that edge, clear
        of the screen. Tap it to see the app name, icon, and the iOS and Android
        identifiers.
        {shortcut !== null
          ? ` If you hide it, press ${shortcut} to show it again.`
          : ""}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        style={styles.primary}
        onPress={() => {
          onChoose(true);
        }}
      >
        <Text style={styles.primaryLabel}>Show the mark</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        style={styles.secondary}
        onPress={() => {
          onChoose(false);
        }}
      >
        <Text style={styles.secondaryLabel}>Not now</Text>
      </Pressable>
    </Sheet>
  );
}

function RecapSheet({
  clientConfig,
  open,
  saving,
  onClose,
  onExited,
  onHide,
}: {
  readonly clientConfig: DeliveryConfig;
  readonly open: boolean;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onExited: () => void;
  readonly onHide: () => void;
}): React.JSX.Element {
  const shortcut = showMarkShortcut();

  return (
    <Sheet open={open} onClose={onClose} onExited={onExited}>
      <AppHeading clientConfig={clientConfig} />
      <PackageIdentity clientConfig={clientConfig} />
      <ErrorTrackingSwitch />
      {shortcut !== null ? (
        <Text style={styles.note}>
          Press {shortcut} to show the mark again.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        style={styles.secondary}
        onPress={onHide}
      >
        <Text style={styles.secondaryLabel}>Hide the mark</Text>
      </Pressable>
    </Sheet>
  );
}

function ErrorTrackingSwitch(): React.JSX.Element {
  const notifiable = useNotifiable();
  const enabled = notifiable.diagnostics !== "disabled";

  return (
    <View style={styles.diagnosticsBox}>
      <View style={styles.trackBox}>
        <View style={styles.trackCopy}>
          <Text style={styles.trackLabel}>Share SDK diagnostics</Text>
          <Text style={styles.trackHint}>
            Help improve Notifiable by sharing SDK crash reports during
            development.
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          hitSlop={8}
          onPress={() => {
            void notifiable.setDiagnostics(!enabled);
          }}
          style={[styles.switchTrack, enabled ? styles.switchOn : null]}
        >
          <View style={[styles.switchKnob, enabled ? styles.knobOn : null]} />
        </Pressable>
      </View>
      <View style={styles.diagnosticsRule} />
      <Text style={styles.manage}>
        Manage diagnostics of SDKs.{" "}
        <Text
          accessibilityRole="link"
          style={styles.diagnosticsLink}
          onPress={() => {
            void Linking.openURL(diagnosticsUrl).catch(() => undefined);
          }}
        >
          Learn what is collected →
        </Text>
      </Text>
    </View>
  );
}

function PackageIdentity({
  clientConfig,
}: {
  readonly clientConfig: DeliveryConfig;
}): React.JSX.Element | null {
  const applicationId = useApplicationId();
  const current =
    Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
  const iosId = textField(clientConfig.ios, "bundle_id");
  const androidId = textField(clientConfig.android, "package_name");
  const iosCheck =
    current === "ios" ? packageCheck(iosId, applicationId) : null;
  const androidCheck =
    current === "android" ? packageCheck(androidId, applicationId) : null;

  if (iosId === null && androidId === null && applicationId === null) {
    return null;
  }

  return (
    <View style={styles.packages}>
      <PackageRow
        label="iOS"
        kind="iOS bundle ID"
        configured={iosId}
        applicationId={current === "ios" ? applicationId : null}
        check={iosCheck}
      />
      <PackageRow
        label="Android"
        kind="Android package"
        configured={androidId}
        applicationId={current === "android" ? applicationId : null}
        check={androidCheck}
      />
    </View>
  );
}

function PackageRow({
  label,
  kind,
  configured,
  applicationId,
  check,
}: {
  readonly label: string;
  readonly kind: string;
  readonly configured: string | null;
  readonly applicationId: string | null;
  readonly check: PackageCheck | null;
}): React.JSX.Element | null {
  if (configured === null && applicationId === null) {
    return null;
  }

  return (
    <View style={styles.packageRow}>
      <View style={styles.packageHeading}>
        <Text style={styles.rowLabel}>{label}</Text>
        {check === "match" ? (
          <View style={styles.checkBadge}>
            <Text style={styles.badgeGlyph}>✓</Text>
          </View>
        ) : null}
        {check === "mismatch" ? (
          <View style={styles.errorBadge}>
            <Text style={styles.badgeGlyph}>!</Text>
          </View>
        ) : null}
      </View>
      <IdentifierLine label="Dashboard" value={configured} />
      {applicationId !== null ? (
        <IdentifierLine label="This app" value={applicationId} />
      ) : null}
      {check === "mismatch" && applicationId !== null ? (
        <View style={styles.packageError}>
          <View style={styles.errorBadge}>
            <Text style={styles.badgeGlyph}>!</Text>
          </View>
          <Text style={styles.packageErrorText}>
            {configured === null
              ? `Set the dashboard ${kind} to ${applicationId}.`
              : `Change the dashboard ${kind} to ${applicationId}.`}
          </Text>
          <CopyButton value={applicationId} />
        </View>
      ) : null}
    </View>
  );
}

function IdentifierLine({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): React.JSX.Element {
  return (
    <View style={styles.identifier}>
      <View style={styles.identifierCopy}>
        <Text style={styles.identifierLabel}>{label}</Text>
        <Text style={styles.identifierValue}>{value ?? "Not set"}</Text>
      </View>
      {value !== null ? <CopyButton value={value} /> : null}
    </View>
  );
}

function CopyButton({ value }: { readonly value: string }): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${value}`}
      hitSlop={8}
      onPress={() => {
        copyText(value);
      }}
      style={styles.copyButton}
    >
      <View style={styles.copyBack} />
      <View style={styles.copyFront} />
    </Pressable>
  );
}

function useApplicationId(): string | null {
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    const read = readDeviceInfo();
    const state = { active: true };

    if (read === null) {
      return;
    }

    void read()
      .then((info) => {
        if (state.active) {
          setApplicationId(applicationIdFrom(info));
        }
      })
      .catch(() => undefined);

    return () => {
      state.active = false;
    };
  }, []);

  return applicationId;
}

function readDeviceInfo(): (() => Promise<unknown>) | null {
  const modules: unknown = NativeModules;

  if (typeof modules !== "object" || modules === null) {
    return null;
  }

  const native: unknown = Reflect.get(modules, "NotifiableDevice");

  if (typeof native !== "object" || native === null) {
    return null;
  }

  const getInfo: unknown = Reflect.get(native, "getInfo");

  if (!isInfoReader(getInfo)) {
    return null;
  }

  return () => getInfo();
}

function copyText(value: string): void {
  const modules: unknown = NativeModules;

  if (typeof modules !== "object" || modules === null) {
    return;
  }

  const native: unknown = Reflect.get(modules, "NotifiableDevice");

  if (typeof native !== "object" || native === null) {
    return;
  }

  const copy: unknown = Reflect.get(native, "copy");

  if (!isCopy(copy)) {
    return;
  }

  copy(value);
}

function applicationIdFrom(info: unknown): string | null {
  if (typeof info !== "object" || info === null) {
    return null;
  }

  const id: unknown = Reflect.get(info, "applicationId");

  return typeof id === "string" && id.length > 0 ? id : null;
}

function isInfoReader(value: unknown): value is () => Promise<unknown> {
  return typeof value === "function";
}

function isCopy(value: unknown): value is (text: string) => void {
  return typeof value === "function";
}

function AppHeading({
  clientConfig,
}: {
  readonly clientConfig: DeliveryConfig;
}): React.JSX.Element {
  const app = clientConfig.app;
  const icon = app?.icon ?? null;

  return (
    <View style={styles.heading}>
      {icon !== null && isIconUrl(icon) ? (
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: icon }}
          style={styles.icon}
        />
      ) : (
        <View style={styles.iconFallback}>
          <Text style={styles.iconMark}>N</Text>
        </View>
      )}
      <Text style={styles.name}>{app?.name ?? "Notifiable"}</Text>
      <View style={styles.environmentBadge}>
        <Text style={styles.environment}>Development</Text>
      </View>
    </View>
  );
}

function Sheet({
  children,
  open = true,
  onClose,
  onExited,
}: {
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly onExited?: () => void;
}): React.JSX.Element | null {
  const window = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const onExitedRef = useRef(onExited);
  const [present, setPresent] = useState(open);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (open) {
      setPresent(true);
    }
  }, [open]);

  useEffect(() => {
    if (!present) {
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 340 : 240,
      easing: open ? easeOutCubic : easeInCubic,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (!finished || open) {
        return;
      }

      setPresent(false);
      onExitedRef.current?.();
    });

    return () => {
      animation.stop();
    };
  }, [open, present, progress]);

  if (!present) {
    return null;
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [window.height, 0],
  });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.backdrop, { opacity: progress }]}
      >
        <Pressable
          accessibilityLabel={
            onClose !== undefined ? "Close Notifiable" : undefined
          }
          style={styles.backdropPress}
          {...(onClose !== undefined ? { onPress: onClose } : {})}
        />
      </Animated.View>
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </View>
  );
}

function DraggableMark({
  onOpen,
}: {
  readonly onOpen: () => void;
}): React.JSX.Element {
  const window = useWindowDimensions();
  const windowRef = useRef(window);
  const onOpenRef = useRef(onOpen);
  const moved = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const placeRef = useRef(restingPoint(window.width, window.height));
  const position = useRef(new Animated.ValueXY(placeRef.current)).current;
  windowRef.current = window;
  onOpenRef.current = onOpen;

  useEffect(() => {
    const next = snapToEdge(
      placeRef.current.x,
      placeRef.current.y,
      window.width,
      window.height,
    );
    placeRef.current = next;
    position.setValue(next);
  }, [position, window.height, window.width]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved.current = false;
        position.stopAnimation();
        origin.current = placeRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        if (Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6) {
          moved.current = true;
        }

        const bounds = windowRef.current;
        const next = clampToFrame(
          origin.current.x + gesture.dx,
          origin.current.y + gesture.dy,
          bounds.width,
          bounds.height,
        );
        placeRef.current = next;
        position.setValue(next);
      },
      onPanResponderRelease: () => {
        if (!moved.current) {
          onOpenRef.current();
          return;
        }

        const bounds = windowRef.current;
        const next = snapToEdge(
          placeRef.current.x,
          placeRef.current.y,
          bounds.width,
          bounds.height,
        );
        placeRef.current = next;
        Animated.spring(position, {
          toValue: next,
          useNativeDriver: false,
          bounciness: 4,
          speed: 18,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      accessibilityRole="button"
      accessibilityLabel="Notifiable"
      style={[styles.mark, { left: position.x, top: position.y }]}
      {...responder.panHandlers}
    >
      <View style={styles.ringMiddle}>
        <View style={styles.ringInner}>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: markIcon }}
            style={styles.markIcon}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function textField(
  record: Readonly<Record<string, unknown>> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isIconUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function restingPoint(width: number, height: number): MarkPoint {
  return snapToEdge(
    width - markSize - sideGap,
    height - markSize - bottomGap,
    width,
    height,
  );
}

function clampToFrame(
  x: number,
  y: number,
  width: number,
  height: number,
): MarkPoint {
  const frame = markFrame(width, height);
  return {
    x: clamp(x, frame.minX, frame.maxX),
    y: clamp(y, frame.minY, frame.maxY),
  };
}

function snapToEdge(
  x: number,
  y: number,
  width: number,
  height: number,
): MarkPoint {
  const frame = markFrame(width, height);
  const point = clampToFrame(x, y, width, height);
  const distanceLeft = point.x - frame.minX;
  const distanceRight = frame.maxX - point.x;
  const distanceTop = point.y - frame.minY;
  const distanceBottom = frame.maxY - point.y;
  const nearest = Math.min(
    distanceLeft,
    distanceRight,
    distanceTop,
    distanceBottom,
  );

  if (nearest === distanceLeft) {
    return { x: frame.minX, y: point.y };
  }

  if (nearest === distanceRight) {
    return { x: frame.maxX, y: point.y };
  }

  if (nearest === distanceTop) {
    return { x: point.x, y: frame.minY };
  }

  return { x: point.x, y: frame.maxY };
}

function markFrame(
  width: number,
  height: number,
): {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
} {
  return {
    minX: sideGap,
    maxX: Math.max(sideGap, width - markSize - sideGap),
    minY: topGap,
    maxY: Math.max(topGap, height - markSize - bottomGap),
  };
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function easeInCubic(value: number): number {
  return value ** 3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type MarkPoint = {
  readonly x: number;
  readonly y: number;
};

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2c2c2c",
    backgroundColor: "#111111",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 18,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 16,
    borderRadius: 2,
    backgroundColor: "#3a3a3a",
  },
  heading: {
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  iconFallback: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#000000",
  },
  iconMark: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  name: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  environmentBadge: {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f5b942",
  },
  environment: {
    color: "#1a1408",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  body: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  row: {
    marginTop: 8,
    gap: 2,
  },
  rowLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 12,
    fontWeight: "600",
  },
  rowValue: {
    color: "#ffffff",
    fontSize: 14,
  },
  packages: {
    marginTop: 8,
    gap: 12,
  },
  packageRow: {
    gap: 6,
  },
  packageHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identifier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identifierCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  identifierLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 11,
    fontWeight: "600",
  },
  identifierValue: {
    color: "#ffffff",
    fontSize: 13,
    flexShrink: 1,
  },
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3ddc97",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ff5c5c",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeGlyph: {
    color: "#111111",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  packageError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  packageErrorText: {
    flex: 1,
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    lineHeight: 16,
  },
  copyButton: {
    width: 16,
    height: 16,
  },
  copyBack: {
    position: "absolute",
    top: 0,
    left: 4,
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.72)",
  },
  copyFront: {
    position: "absolute",
    top: 4,
    left: 0,
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#111111",
  },
  primary: {
    marginTop: 12,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingVertical: 14,
  },
  primaryLabel: {
    color: "#111111",
    fontSize: 16,
    fontWeight: "600",
  },
  secondary: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryLabel: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 15,
  },
  note: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
  },
  diagnosticsBox: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  trackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trackCopy: {
    flex: 1,
    gap: 2,
  },
  trackLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  trackHint: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    lineHeight: 15,
  },
  diagnosticsRule: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  manage: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 11,
    lineHeight: 15,
  },
  diagnosticsLink: {
    color: "#f5b942",
    fontWeight: "600",
  },
  switchTrack: {
    width: 32,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    padding: 2,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  switchOn: {
    backgroundColor: "#f5b942",
  },
  switchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  knobOn: {
    alignSelf: "flex-end",
  },
  mark: {
    position: "absolute",
    width: markSize,
    height: markSize,
    borderRadius: markSize / 2,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    padding: ringWidth,
    overflow: "hidden",
  },
  ringMiddle: {
    flex: 1,
    borderRadius: (markSize - ringWidth * 2) / 2,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: ringWidth,
    overflow: "hidden",
  },
  ringInner: {
    flex: 1,
    borderRadius: (markSize - ringWidth * 4) / 2,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: ringWidth,
    overflow: "hidden",
  },
  markIcon: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
  },
});
