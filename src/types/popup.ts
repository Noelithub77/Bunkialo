import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";

export type PopupIconType =
  | "notifications"
  | "warning"
  | "information"
  | "alert-circle"
  | "calendar"
  | "fast-food"
  | "restaurant"
  | "school"
  | "sparkles"
  | "star";

export type PopupCtaAction = "open-course-feedback" | "open-url";

export interface PopupHighlight {
  title: string;
  description: string;
  reference: string;
  url: string;
}

export interface PopupCustomContentProps {
  popup: PopupNotice;
}

/** A recurring ask, such as starring the repo, rather than a one-off announcement. */
export interface PopupPrompt {
  firstShowAfterDays: number;
  snoozeDays: number;
}

export interface PopupNotice {
  id: string;
  title: string;
  description: string;
  timestamp: string; // ISO date string
  icon?: PopupIconType;
  imageSource?: ImageSourcePropType;
  imageSourceDark?: ImageSourcePropType;
  imageSourceLight?: ImageSourcePropType;
  iconColor?: string;
  isImportant?: boolean;
  ctaLabel?: string;
  ctaIcon?: ComponentProps<typeof Ionicons>["name"];
  ctaAction?: PopupCtaAction;
  ctaUrl?: string;
  /** Replaces the "Got it" button with a corner close button. */
  closeButton?: boolean;
  /** A link under the main action; the popup stays open. */
  secondaryCta?: {
    label: string;
    icon?: ComponentProps<typeof Ionicons>["name"];
    url: string;
  };
  hero?: ComponentType;
  customContent?: ComponentType<PopupCustomContentProps>;
  highlights?: PopupHighlight[];
  prompt?: PopupPrompt;
}
