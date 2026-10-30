import { useGestureUiStore } from "@/stores/gesture-ui-store";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

export function useCarouselGesture() {
  const owner = useRef(Symbol("carousel gesture")).current;
  const release = useCallback(() => {
    useGestureUiStore.getState().endHorizontalContentGesture(owner);
  }, [owner]);

  useFocusEffect(useCallback(() => release, [release]));

  const onTouchStart = useCallback(() => {
    // Decide ownership before either pager starts moving. Momentum owns no touch.
    useGestureUiStore.getState().beginHorizontalContentGesture(owner);
  }, [owner]);

  return { onTouchStart, onTouchEnd: release, onTouchCancel: release };
}
