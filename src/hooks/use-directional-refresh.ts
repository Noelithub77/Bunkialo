import { useGestureUiStore } from "@/stores/gesture-ui-store";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import { getRefreshGestureDirection, type RefreshGestureDirection } from "@/utils/refresh-gesture";

export function useDirectionalRefresh(onRefresh: () => void | Promise<void>) {
  const tabSwipeActive = useGestureUiStore((state) => state.isTabSwipeActive);
  const start = useRef({ x: 0, y: 0 });
  const direction = useRef<RefreshGestureDirection>("undecided");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => useGestureUiStore.subscribe((state) => {
    if (state.isTabSwipeActive) {
      direction.current = "horizontal";
      setEnabled(false);
    }
  }), []);

  const onTouchStart = useCallback((event: GestureResponderEvent) => {
    start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    direction.current = "undecided";
    setEnabled(true);
  }, []);
  const onTouchMove = useCallback((event: GestureResponderEvent) => {
    if (direction.current !== "undecided") return;
    direction.current = getRefreshGestureDirection(
      event.nativeEvent.pageX - start.current.x,
      event.nativeEvent.pageY - start.current.y,
    );
    if (direction.current === "horizontal") setEnabled(false);
  }, []);
  const refresh = useCallback(() => {
    // Keep the direction after touch end: Android may deliver onRefresh afterward.
    if (direction.current === "pull" && !useGestureUiStore.getState().isTabSwipeActive) {
      direction.current = "vertical";
      void onRefresh();
    }
  }, [onRefresh]);

  return { enabled: enabled && !tabSwipeActive, onRefresh: refresh, touchHandlers: { onTouchStart, onTouchMove } };
}
