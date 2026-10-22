import { AllpyqLaunchPopupContent } from "@/components/dashboard/popup/allpyq-launch-popup-content";
import { ReleasePopupContent } from "@/components/dashboard/popup/release-popup-content";
import { Colors } from "@/constants/theme";
import type { PopupNotice } from "@/types";

export const POPUP_NOTICES: PopupNotice[] = [
  {
    id: "bunkialo-v1-5-2026-10",
    title: "Bunkialo v1.5",
    description: "Faster assignments and file previews in v1.5, plus new ways to use Bunkialo.",
    timestamp: "2026-10-19T12:00:00+05:30",
    iconColor: Colors.status.info,
    isImportant: true,
    ctaLabel: "Update",
    ctaPlacement: "header",
    ctaAction: "open-url",
    ctaUrl: "https://github.com/Noelithub77/Bunkialo/releases/tag/v1.5.0(64)",
    highlights: [
      {
        title: "Android widgets", reference: "PR #34",
        description: "Timetable and mess menu on your home screen.",
        url: "https://github.com/Noelithub77/Bunkialo/pull/34",
      },
      {
        title: "Wear OS app", reference: "PR #32",
        description: "Timetable, mess menu and rotary scrolling on your watch.",
        url: "https://github.com/Noelithub77/Bunkialo/pull/32",
      },
      {
        title: "New: Bunkialo CLI", reference: "PR #35",
        description: "Courses, assignments and downloads from your terminal.",
        url: "https://github.com/Noelithub77/Bunkialo/pull/35",
      },
      {
        title: "New: landing page", reference: "Commit 75f7e6d",
        description: "A fresh tour of the app, CLI and campus tools.",
        url: "https://github.com/Noelithub77/Bunkialo/commit/75f7e6d7213fb17c1ce4d07057f5c47f61f1c048",
      },
    ],
    customContent: ReleasePopupContent,
  },
  {
    id: "allpyq-launch-2026-04",
    title: "AllPYQ Is Out",
    description:
      "AllPYQ is live: topic-wise PYQs, trend insights, instant AI solutions, and adaptive learning guides.",
    timestamp: "2026-04-14T12:00:00+05:30",
    iconColor: Colors.accent,
    isImportant: true,
    ctaLabel: "Explore AllPYQ",
    ctaAction: "open-url",
    ctaUrl: "https://allpyq.in",
    imageSourceDark: require("../../assets/icons/allpyq_dark.png"),
    imageSourceLight: require("../../assets/icons/allpyq_light.png"),
    customContent: AllpyqLaunchPopupContent,
  },
  {
    id: "course-feedback-2026-10",
    title: "Your feedback, your choice",
    description:
      "Feedback should always be optional. No one should feel pressured to fill in a form or give a particular rating. If you choose to respond, the answers are yours — this tool is only here to make it easier. You can find it any time under More or Settings.",
    timestamp: "2026-10-22T12:00:00+05:30",
    icon: "school",
    iconColor: Colors.status.info,
    isImportant: false,
    ctaLabel: "View course feedback",
    ctaAction: "open-course-feedback",
  },
  // {
  //   id: "menu-update-2026-03",
  //   title: "Menu Updated",
  //   description:
  //     "The mess menu has been updated to the temporary menu of 2026.",
  //   timestamp: "2026-03-17T12:00:00+05:30",
  //   icon: "restaurant",
  //   iconColor: Colors.status.success,
  //   isImportant: true,
  // },
];
