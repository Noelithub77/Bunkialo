export interface WidgetCard {
  id: string;
  day: number;
  startMinute: number;
  endMinute: number;
  name: string;
  time: string;
  color: string;
  lightBackground: string;
  darkBackground: string;
  /** File URIs of the generated gradient images (Android). */
  darkBackgroundImage?: string;
  lightBackgroundImage?: string;
  items: string[];
}

export interface ScheduleWidgetProps {
  cards: WidgetCard[];
  page: number;
  anchor: number;
  utcOffsetMinutes: number;
  /** Shown when there are no cards, e.g. while signed out. */
  emptyMessage?: string;
}
