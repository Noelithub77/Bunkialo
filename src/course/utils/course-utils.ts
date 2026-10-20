import { Colors } from "@/constants/theme";
import type { LmsResourceItemNode, LmsResourceSectionNode } from "@/types";
import { MODULE_VISUALS } from "@/course/constants/module-visuals";
import { SECTION_TONES } from "@/course/constants/section-tones";
import type { ModuleVisual, Tone } from "@/course/types/visual-types";

export const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const sectionNodeKey = (section: LmsResourceSectionNode): string =>
  `section:${section.id}`;

export const itemNodeKey = (item: LmsResourceItemNode): string =>
  `item:${item.id}`;

export const getSectionTone = (sectionIndex: number, isDark: boolean): Tone => {
  const tone = SECTION_TONES[sectionIndex % SECTION_TONES.length];
  return isDark ? tone.dark : tone.light;
};

export const getModuleVisual = (
  item: LmsResourceItemNode,
): ModuleVisual => {
  const visual = MODULE_VISUALS[item.moduleType] ?? MODULE_VISUALS.unknown;
  return {
    ...visual,
    tone: {
      light: visual.tone.light,
      dark: visual.tone.dark,
    },
  };
};

export const moduleLabel = (item: LmsResourceItemNode): string => {
  if (item.typeLabel) return item.typeLabel;
  const visual = MODULE_VISUALS[item.moduleType] ?? MODULE_VISUALS.unknown;
  return visual.label;
};

export const resolveCourseColorFallback = (courseId: string): string => {
  const parsedId = Number(courseId);
  if (Number.isFinite(parsedId)) {
    return Colors.courseColors[parsedId % Colors.courseColors.length];
  }

  const hash = courseId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Colors.courseColors[hash % Colors.courseColors.length];
};

export const toRgba = (color: string, alpha: number): string => {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1);
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex;
  if (normalized.length !== 6) return color;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) return color;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
