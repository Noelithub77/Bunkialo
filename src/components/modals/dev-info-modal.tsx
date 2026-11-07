import { PillButton } from "@/components/ui/pill-button";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Updates from "expo-updates";
import { useEffect, useId, useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type DevInfoModalProps = {
  visible: boolean;
  onClose: () => void;
};

const GITHUB_REPO_URL = "https://github.com/Noelithub77/bunkialo2";
const COFFEE_URL = "upi://pay?pa=noelmcv7@oksbi&cu=INR";
const APP_ICON = require("../../../assets/images/icon.png");

const openUrl = (url: string) => {
  Linking.openURL(url).catch(() => {
    // The target app or browser may be missing; keep the card usable.
  });
};

const getVersion = () => {
  const expoConfig = Constants.expoConfig;
  const configBuild =
    expoConfig?.ios?.buildNumber ??
    (expoConfig?.android?.versionCode ? String(expoConfig.android.versionCode) : null);
  const isExpoGo = Constants.appOwnership === "expo";
  const version = isExpoGo
    ? (expoConfig?.version ?? Application.nativeApplicationVersion ?? "0.0.0")
    : (Application.nativeApplicationVersion ?? expoConfig?.version ?? "0.0.0");
  const build = isExpoGo
    ? (configBuild ?? Application.nativeBuildVersion)
    : (Application.nativeBuildVersion ?? configBuild);
  return build ? `v${version} (${build})` : `v${version}`;
};

function UpdateStatusPill({ visible, isDark }: { visible: boolean; isDark: boolean }) {
  const theme = isDark ? Colors.dark : Colors.light;
  const { isChecking, isUpdateAvailable, isUpdatePending, lastCheckForUpdateTimeSinceRestart } =
    Updates.useUpdates();

  useEffect(() => {
    if (!visible || !Updates.isEnabled || __DEV__) return;
    Updates.checkForUpdateAsync().catch(() => {
      // Offline or misconfigured channels simply leave the status unknown.
    });
  }, [visible]);

  const status = isChecking
    ? { label: "Checking", color: theme.textSecondary }
    : isUpdatePending
      ? { label: "Restart to update", color: Colors.accent }
      : isUpdateAvailable
        ? { label: "Update available", color: Colors.accent }
        : lastCheckForUpdateTimeSinceRestart
          ? { label: "Up to date", color: Colors.status.success }
          : null;
  if (!status) return null;

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full border px-3 py-1"
      style={{ backgroundColor: theme.backgroundSecondary, borderColor: theme.border }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
      <Text className="text-[11px] font-semibold" style={{ color: theme.textSecondary }}>
        {status.label}
      </Text>
    </View>
  );
}

function CreditRow({
  label,
  people,
  isDark,
  showDivider,
}: {
  label: string;
  people: { name: string; url: string }[];
  isDark: boolean;
  showDivider: boolean;
}) {
  const theme = isDark ? Colors.dark : Colors.light;
  return (
    <View
      className="flex-row items-center justify-between gap-3 px-4 py-3"
      style={showDivider ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined}
    >
      <Text className="text-[13px]" style={{ color: theme.textSecondary }}>
        {label}
      </Text>
      <View className="shrink flex-row flex-wrap justify-end">
        {people.map((person, index) => (
          <Text key={person.name} className="text-[13px] font-semibold" style={{ color: theme.text }}>
            {index > 0 ? ", " : ""}
            <Text accessibilityRole="link" onPress={() => openUrl(person.url)}>
              {person.name}
            </Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

export const DevInfoModal = ({ visible, onClose }: DevInfoModalProps) => {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const glowId = `about-glow-${useId().replace(/:/g, "")}`;
  const [showUpdateDetails, setShowUpdateDetails] = useState(false);

  // `eas update --message` stores the message in the manifest metadata.
  const manifest = Updates.manifest as { metadata?: { message?: string } } | null;
  const updateMessage = manifest?.metadata?.message;
  const updateId = Updates.updateId;
  const hasUpdateInfo = Boolean(updateId) && Constants.appOwnership !== "expo";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,15,15,0.3)" }}
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-[360px] overflow-hidden rounded-[32px] border"
          style={{
            borderColor: theme.border,
            shadowColor: Colors.black,
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: isDark ? 0.5 : 0.16,
            shadowRadius: 40,
            elevation: 16,
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <LinearGradient
            colors={isDark ? Gradients.dark.sheet : Gradients.light.sheet}
            style={{ position: "absolute", inset: 0 }}
          />
          <Svg style={{ position: "absolute", top: 0, left: 0, right: 0 }} width="100%" height={160}>
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="0%" rx="55%" ry="100%">
                <Stop offset="0" stopColor={Colors.accent} stopOpacity={isDark ? 0.3 : 0.35} />
                <Stop offset="1" stopColor={Colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
          </Svg>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={8}
            className="absolute right-4 top-4 z-10 h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </Pressable>

          <View className="items-center px-5 pb-5 pt-7">
            <Image
              source={APP_ICON}
              style={{ width: 72, height: 72, borderRadius: 36 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <Text className="mt-3 text-[19px] font-bold tracking-tight" style={{ color: theme.text }}>
              Bunkialo
            </Text>

            <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
              <Pressable
                accessibilityRole={hasUpdateInfo ? "button" : "text"}
                accessibilityState={hasUpdateInfo ? { expanded: showUpdateDetails } : undefined}
                accessibilityHint={hasUpdateInfo ? "Shows the installed update" : undefined}
                disabled={!hasUpdateInfo}
                onPress={() => setShowUpdateDetails((shown) => !shown)}
                className="flex-row items-center gap-1 rounded-full border px-3 py-1"
                style={{ backgroundColor: theme.backgroundSecondary, borderColor: theme.border }}
              >
                <Text className="text-[11px] font-semibold" style={{ color: theme.textSecondary }}>
                  {getVersion()}
                </Text>
                {hasUpdateInfo ? (
                  <Ionicons
                    name={showUpdateDetails ? "chevron-up" : "chevron-down"}
                    size={11}
                    color={theme.textSecondary}
                  />
                ) : null}
              </Pressable>
              <UpdateStatusPill visible={visible} isDark={isDark} />
            </View>

            {showUpdateDetails && hasUpdateInfo ? (
              <View className="mt-3 w-full gap-1 rounded-[18px] px-4 py-3" style={{ backgroundColor: theme.backgroundSecondary }}>
                {updateMessage ? (
                  <Text className="text-[12px]" style={{ color: theme.text }} numberOfLines={2}>
                    {updateMessage}
                  </Text>
                ) : null}
                <View className="flex-row justify-between gap-3">
                  {Updates.createdAt ? (
                    <Text className="text-[11px]" style={{ color: theme.textSecondary }}>
                      {Updates.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  ) : null}
                  <Text className="text-[11px]" style={{ color: theme.textSecondary, fontFamily: "monospace" }}>
                    {updateId?.slice(0, 8)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View
              className="mt-5 w-full overflow-hidden rounded-[22px] border"
              style={{ backgroundColor: theme.backgroundSecondary, borderColor: theme.border }}
            >
              <CreditRow
                label="Built by"
                isDark={isDark}
                showDivider={false}
                people={[{ name: "Noel Georgi", url: "https://www.linkedin.com/in/noel-georgi/" }]}
              />
              <CreditRow
                label="Ideas by"
                isDark={isDark}
                showDivider
                people={[
                  { name: "Srimoney", url: "https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/" },
                  { name: "Niranjan V", url: "https://www.linkedin.com/in/niranjan-vasudevan/" },
                ]}
              />
            </View>

            <View className="mt-4 w-full flex-row gap-2">
              <PillButton
                className="flex-1"
                variant="soft"
                icon="cafe-outline"
                label="Coffee"
                accessibilityRole="link"
                onPress={() => openUrl(COFFEE_URL)}
              />
              <PillButton
                className="flex-1"
                icon="logo-github"
                label="Star"
                accessibilityRole="link"
                onPress={() => openUrl(GITHUB_REPO_URL)}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
