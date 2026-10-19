import { useLayoutEffect, useState, type ComponentRef, type RefObject } from "react";
import { Platform, useWindowDimensions, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useNotificationPlacement(
  visible: boolean,
  anchorRef: RefObject<ComponentRef<typeof View> | null>,
) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchored = Platform.OS === "web" && width >= 768;
  const [anchor, setAnchor] = useState<{
    right: number;
    bottom: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchored) return;
    let active = true;
    // Let the dashboard finish its responsive layout before measuring on resize.
    const frame = requestAnimationFrame(() => {
      anchorRef.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
        if (active) {
          setAnchor({ right: x + anchorWidth, bottom: y + anchorHeight });
        }
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [anchorRef, anchored, height, visible, width]);

  const top = Math.max(
    insets.top + 16,
    Math.min(anchor ? anchor.bottom + 10 : 76, height - 160),
  );
  const panelWidth = anchored ? 440 : Math.min(520, width - 32);
  const style = anchored
    ? {
        position: "absolute" as const,
        width: panelWidth,
        top,
        left: Math.max(
          16,
          Math.min(
            (anchor?.right ?? width - 16) - panelWidth,
            width - panelWidth - 16,
          ),
        ),
        maxHeight: height - top - 16,
      }
    : {
        position: "absolute" as const,
        width: panelWidth,
        left: (width - panelWidth) / 2,
        bottom: Math.max(16, insets.bottom),
        maxHeight: height - insets.top - Math.max(16, insets.bottom) - 16,
      };
  return {
    anchored,
    style: { ...style, opacity: anchored && !anchor ? 0 : 1 },
  };
}
