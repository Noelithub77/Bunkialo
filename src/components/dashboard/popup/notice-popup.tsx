import React, { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import {
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/ui/pill-button";
import { Colors, Gradients } from "@/constants/theme";
import { POPUP_NOTICES } from "@/data/popups";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNotificationPlacement } from "@/hooks/use-notification-placement";
import { getDuePrompt, getUnseenAnnouncements, isAnnouncement } from "@/services/popup-queue";
import { usePopupStore } from "@/stores/popup-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { PopupNotice } from "@/types";
import { hasNotificationPermissions, sendImmediateNotification } from "@/utils/notifications";
import { SpotlightHero } from "./spotlight-hero";

type CloseReason = "dismiss" | "cta";

function NoticePage({ popup, isDark }: { popup: PopupNotice; isDark: boolean }) {
  const theme = isDark ? Colors.dark : Colors.light;
  const CustomContent = popup.customContent;

  return (
    <View>
      <SpotlightHero popup={popup} isDark={isDark} />
      <View className="gap-3 px-5 pb-2">
        <Text
          className="text-center text-[19px] font-bold tracking-tight"
          style={{ color: theme.text }}
        >
          {popup.title}
        </Text>
        {CustomContent ? (
          <CustomContent popup={popup} />
        ) : (
          <Text
            className="text-center text-[14px] leading-[21px]"
            style={{ color: theme.textSecondary }}
          >
            {popup.description}
          </Text>
        )}
      </View>
    </View>
  );
}

export function NoticePopup({ anchorRef }: { anchorRef: RefObject<ComponentRef<typeof View> | null> }) {
  const hasHydrated = usePopupStore((state) => state.hasHydrated);
  const seenPopupIds = usePopupStore((state) => state.seenPopupIds);
  const dismissedPopupIds = usePopupStore((state) => state.dismissedPopupIds);
  const notifiedPopupIds = usePopupStore((state) => state.notifiedPopupIds);
  const snoozedUntil = usePopupStore((state) => state.snoozedUntil);
  const firstOpenedAt = usePopupStore((state) => state.firstOpenedAt);
  const markAsSeen = usePopupStore((state) => state.markAsSeen);
  const markAsNotified = usePopupStore((state) => state.markAsNotified);
  const dismissPopups = usePopupStore((state) => state.dismissPopups);
  const snoozePopup = usePopupStore((state) => state.snoozePopup);
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);

  const [queue, setQueue] = useState<PopupNotice[]>([]);
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeights, setPageHeights] = useState<Record<string, number>>({});
  const [scrollX] = useState(() => new Animated.Value(0));
  const pagerRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Never stack the star prompt right after announcements in the same session.
  const hasShownAnnouncementRef = useRef(false);

  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { anchored, style: anchoredStyle } = useNotificationPlacement(visible, anchorRef);
  const [progress] = useState(() => new Animated.Value(0));
  const current = queue[page] ?? null;

  useEffect(() => {
    if (!hasHydrated || visible) return;
    const announcements = getUnseenAnnouncements(POPUP_NOTICES, { seenPopupIds, dismissedPopupIds });
    const prompt =
      announcements.length === 0 && !hasShownAnnouncementRef.current
        ? getDuePrompt(
            POPUP_NOTICES,
            { seenPopupIds, dismissedPopupIds, snoozedUntil, firstOpenedAt },
            Date.now(),
          )
        : null;
    const next = prompt ? [prompt] : announcements;
    if (next.length === 0) return;

    if (!prompt) hasShownAnnouncementRef.current = true;
    progress.setValue(0);
    scrollX.setValue(0);
    setQueue(next);
    setPage(0);
    setVisible(true);
  }, [dismissedPopupIds, firstOpenedAt, hasHydrated, progress, scrollX, seenPopupIds, snoozedUntil, visible]);

  useEffect(() => {
    if (!visible) return;
    Animated.spring(progress, {
      toValue: 1,
      damping: 24,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  useEffect(() => {
    if (visible && current && isAnnouncement(current)) markAsSeen(current.id);
  }, [current, markAsSeen, visible]);

  useEffect(() => {
    if (!current || !isAnnouncement(current) || !notificationsEnabled) return;
    if (notifiedPopupIds.includes(current.id)) return;

    void (async () => {
      if (!(await hasNotificationPermissions())) return;
      const data: Record<string, string> = { type: "notice-popup", popupId: current.id };
      if (current.ctaAction) data.ctaAction = current.ctaAction;
      if (current.ctaUrl) data.ctaUrl = current.ctaUrl;
      try {
        await sendImmediateNotification({
          title: current.title,
          body:
            current.id === "allpyq-launch-2026-04"
              ? "Topic-wise PYQs, trend insights, AI solutions, and adaptive learning guides are now live at allpyq.in."
              : current.description,
          channelId: "default",
          data,
        });
        markAsNotified(current.id);
      } catch {
        // A failed system notification must not break the in-app notice.
      }
    })();
  }, [current, markAsNotified, notificationsEnabled, notifiedPopupIds]);

  const close = useCallback(
    (reason: CloseReason) => {
      for (const popup of queue) {
        if (isAnnouncement(popup)) markAsSeen(popup.id);
        else if (reason === "cta") dismissPopups([popup.id]);
        else if (popup.prompt) snoozePopup(popup.id, popup.prompt.snoozeDays);
      }
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setVisible(false);
        setQueue([]);
      });
    },
    [dismissPopups, markAsSeen, progress, queue, snoozePopup],
  );

  if (!hasHydrated || !visible || !current) return null;

  const hasCta =
    (current.ctaAction === "open-url" && Boolean(current.ctaUrl)) ||
    current.ctaAction === "open-course-feedback";
  const runCta = () => {
    if (current.ctaAction === "open-course-feedback") router.push("/course-feedback");
    else if (current.ctaUrl) void Linking.openURL(current.ctaUrl);
    close("cta");
  };
  const goToPage = (index: number) => {
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    setPage(index);
  };

  const measurePage = (id: string, height: number) =>
    setPageHeights((heights) => (heights[id] === height ? heights : { ...heights, [id]: height }));
  // Follow the swipe so short pages don't inherit the tallest page's height.
  const pagerHeight =
    pageWidth > 0 && queue.every((popup) => pageHeights[popup.id] !== undefined)
      ? scrollX.interpolate({
          inputRange: queue.map((_, index) => index * pageWidth),
          outputRange: queue.map((popup) => pageHeights[popup.id] ?? 0),
          extrapolate: "clamp",
        })
      : undefined;

  const card = (
    <View
      testID="announcement-panel"
      accessibilityLabel={current.title}
      className="w-full shrink overflow-hidden rounded-[32px] border"
      style={{
        borderColor: theme.border,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: isDark ? 0.5 : 0.16,
        shadowRadius: 40,
        elevation: 16,
      }}
    >
      <LinearGradient
        colors={isDark ? Gradients.dark.sheet : Gradients.light.sheet}
        style={{ position: "absolute", inset: 0 }}
      />
      <ScrollView
        className="shrink"
        bounces={false}
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
      >
        {queue.length > 1 ? (
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            style={pagerHeight ? { height: pagerHeight } : undefined}
            contentContainerStyle={{ alignItems: "flex-start" }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
              useNativeDriver: false,
              listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (pageWidth === 0) return;
                const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                if (next !== page && next >= 0 && next < queue.length) setPage(next);
              },
            })}
          >
            {queue.map((popup) => (
              <View
                key={popup.id}
                style={{ width: pageWidth }}
                onLayout={(event) => measurePage(popup.id, event.nativeEvent.layout.height)}
              >
                <NoticePage popup={popup} isDark={isDark} />
              </View>
            ))}
          </Animated.ScrollView>
        ) : (
          <NoticePage popup={current} isDark={isDark} />
        )}
      </ScrollView>

      <View className="gap-1 px-5 pt-3" style={{ paddingBottom: 16 }}>
        {queue.length > 1 ? (
          <View className="mb-2 flex-row items-center justify-center gap-1.5">
            {queue.map((popup, index) => (
              <Pressable
                key={popup.id}
                accessibilityRole="button"
                accessibilityLabel={`Show ${popup.title}`}
                accessibilityState={{ selected: index === page }}
                hitSlop={8}
                onPress={() => goToPage(index)}
                className="h-1.5 rounded-full"
                style={{
                  width: index === page ? 18 : 6,
                  backgroundColor: index === page ? theme.text : theme.border,
                }}
              />
            ))}
          </View>
        ) : null}
        {hasCta ? (
          <PillButton label={current.ctaLabel ?? "Open"} icon={current.ctaIcon} onPress={runCta} />
        ) : null}
        {current.secondaryCta ? (
          <PillButton
            variant="soft"
            accessibilityRole="link"
            className="mt-1.5"
            label={current.secondaryCta.label}
            icon={current.secondaryCta.icon}
            onPress={() => {
              if (current.secondaryCta) void Linking.openURL(current.secondaryCta.url);
              close("dismiss");
            }}
          />
        ) : null}
        {current.closeButton ? null : (
          <PillButton variant="ghost" label="Got it" onPress={() => close("dismiss")} />
        )}
      </View>

      {current.closeButton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={() => close("dismiss")}
          className="absolute right-3.5 top-3.5 h-8 w-8 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}
        >
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );

  const motion = {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [anchored ? 8 : 18, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
    ],
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close("dismiss")}>
      <View className="flex-1">
        <Animated.View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: isDark ? "rgba(0,0,0,0.82)" : "rgba(15,15,15,0.5)",
            opacity: progress,
          }}
        >
          <Pressable
            className="flex-1"
            focusable={false}
            accessibilityLabel="Close"
            onPress={() => close("dismiss")}
          />
        </Animated.View>
        {anchored ? (
          <Animated.View style={[anchoredStyle, motion]}>{card}</Animated.View>
        ) : (
          <View
            pointerEvents="box-none"
            className="absolute inset-0 items-center justify-center px-4"
            style={{ paddingTop: insets.top + 16, paddingBottom: Math.max(16, insets.bottom) }}
          >
            <Animated.View style={[{ width: "100%", maxWidth: 420, flexShrink: 1 }, motion]}>
              {card}
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}
