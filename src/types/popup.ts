import type { ComponentType } from "react";
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
  onClose: () => void;
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
  ctaPlacement?: "header";
  ctaAction?: PopupCtaAction;
  ctaUrl?: string;
  customContent?: ComponentType<PopupCustomContentProps>;
  highlights?: PopupHighlight[];
}
