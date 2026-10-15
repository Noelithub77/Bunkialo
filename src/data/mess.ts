import menuData from "../../data/mess-menu.json";

export type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

export interface Meal {
  type: MealType;
  name: string;
  items: string[];
  startTime: string;
  endTime: string;
}

export interface DayMenu {
  day: number; // 0=Sun, 1=Mon, etc
  meals: Meal[];
}

export const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "#62df15", // green
  lunch: "#1be7a3", // emerald
  snacks: "#b16d07", // orange
  dinner: "#6d20b0", // purple
};

const isMealType = (value: string): value is MealType =>
  value === "breakfast" ||
  value === "lunch" ||
  value === "snacks" ||
  value === "dinner";

export const MESS_MENU: DayMenu[] = menuData.map((day) => ({
  day: day.day,
  meals: day.meals.map((meal) => {
    if (!isMealType(meal.type)) {
      throw new Error(`Unknown meal type in mess menu: ${meal.type}`);
    }

    return { ...meal, type: meal.type };
  }),
}));

const getMealTiming = (
  type: MealType,
): { start: string; end: string; name: string } => {
  const meal = MESS_MENU.flatMap((day) => day.meals).find(
    (menuMeal) => menuMeal.type === type,
  );
  if (!meal) throw new Error(`No ${type} meal in mess menu`);

  return { start: meal.startTime, end: meal.endTime, name: meal.name };
};

export const MEAL_TIMES: Record<
  MealType,
  { start: string; end: string; name: string }
> = {
  breakfast: getMealTiming("breakfast"),
  lunch: getMealTiming("lunch"),
  snacks: getMealTiming("snacks"),
  dinner: getMealTiming("dinner"),
};

export const getMenuForDay = (dayOfWeek: number): DayMenu | undefined =>
  MESS_MENU.find((menu) => menu.day === dayOfWeek);

export const getCurrentMeal = (
  now: Date,
): { current: Meal | null; next: Meal | null } => {
  const dayMenu = getMenuForDay(now.getDay());
  if (!dayMenu) return { current: null, next: null };

  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  let current: Meal | null = null;
  let next: Meal | null = null;

  for (const meal of dayMenu.meals) {
    if (currentTime >= meal.startTime && currentTime < meal.endTime) {
      current = meal;
    } else if (currentTime < meal.startTime && !next) {
      next = meal;
    }
  }

  if (!current && !next) {
    const tomorrowMenu = getMenuForDay((now.getDay() + 1) % 7);
    next = tomorrowMenu?.meals[0] || null;
  }

  return { current, next };
};

export const getNearbyMeals = (
  now: Date,
): { meals: Meal[]; initialIndex: number } => {
  const dayMenu = getMenuForDay(now.getDay());
  if (!dayMenu) return { meals: [], initialIndex: 0 };

  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  let initialIndex = 0;
  for (let i = 0; i < dayMenu.meals.length; i++) {
    const meal = dayMenu.meals[i];
    if (currentTime >= meal.startTime && currentTime < meal.endTime) {
      initialIndex = i;
      break;
    } else if (currentTime < meal.startTime) {
      initialIndex = i;
      break;
    } else {
      initialIndex = i;
    }
  }

  return { meals: dayMenu.meals, initialIndex };
};
