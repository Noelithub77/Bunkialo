// Mess menu transcribed from the October 2026 notice.

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

export const MEAL_TIMES: Record<
  MealType,
  { start: string; end: string; name: string }
> = {
  breakfast: { start: "07:00", end: "09:30", name: "Breakfast" },
  lunch: { start: "12:00", end: "14:30", name: "Lunch" },
  snacks: { start: "16:00", end: "18:00", name: "Snacks" },
  dinner: { start: "19:00", end: "20:30", name: "Dinner" },
};

const createMeal = (type: MealType, items: string[]): Meal => ({
  type,
  name: MEAL_TIMES[type].name,
  items,
  startTime: MEAL_TIMES[type].start,
  endTime: MEAL_TIMES[type].end,
});

export const MESS_MENU: DayMenu[] = [
  // sunday (0)
  {
    day: 0,
    meals: [
      createMeal("breakfast", [
        "Puri Masala",
        "Pongal",
        "Groundnut podi",
        "Boiled Egg",
        "Sprouts",
        "Banana",
        "Bread (Normal/Brown)",
        "Jam",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Kerala rice",
        "Rice",
        "Roti",
        "Carrot cabbage chana thoran",
        "Onion Dal Tadka",
        "Rasam",
        "Curd",
        "Coriander Tomato chutney",
        "Salad",
        "Drink: Sweet Lassi",
      ]),
      createMeal("snacks", [
        "Sweet Naan",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Chicken Biryani",
        "Paneer Biryani",
        "Veg Gravy",
        "Chicken Gravy",
        "Onion Chilli Raita",
        "Papad",
        "Salad",
        "Drink: Tang",
      ]),
    ],
  },
  // monday (1)
  {
    day: 1,
    meals: [
      createMeal("breakfast", [
        "Dosa",
        "Medu vada",
        "Aloo masala",
        "Sambar",
        "Coconut Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Kerala rice",
        "Roti",
        "Parippu dal",
        "Beans Poriyal",
        "Rasam",
        "Kondattam",
        "Chips",
        "Salad",
        "Puliyinchi",
        "Curd",
        "Fruit: Watermelon",
      ]),
      createMeal("snacks", [
        "Cream bun",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Boiled Egg",
        "Tomato Chilli Gravy",
        "Beetroot Thoran",
        "Dal",
        "Papad",
        "Curd",
        "Salad",
        "Drink: Buttermilk",
      ]),
    ],
  },
  // tuesday (2)
  {
    day: 2,
    meals: [
      createMeal("breakfast", [
        "Vada Pav",
        "Puttu",
        "Channa Curry",
        "Fried Chillies",
        "Onions",
        "Green Chutney",
        "Red Powdered Chutney",
        "Banana",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Kerala rice",
        "Roti",
        "Chicken masala curry",
        "Paneer Butter masala",
        "Vegetable Raita",
        "Salad",
        "Drink: Tang",
      ]),
      createMeal("snacks", [
        "Pazhampuri",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Rajma curry",
        "Onion Dal Tadka",
        "Bottle gourd stir fry",
        "Rasam",
        "Chips",
        "Salad",
        "Curd",
        "Drink: Buttermilk",
      ]),
    ],
  },
  // wednesday (3)
  {
    day: 3,
    meals: [
      createMeal("breakfast", [
        "Idli",
        "Masala Idli",
        "Punugulu",
        "Sambar",
        "Groundnut Chutney",
        "Tomato chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Roti",
        "Rice",
        "Onion Dal Tadka",
        "Kerala rice",
        "Soya chunks dry",
        "Pulissery",
        "Pachi pulusu",
        "Curd",
        "Salad",
        "Sweet: Vermicelli Kesari",
      ]),
      createMeal("snacks", [
        "Sweetcorn (boiled)",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Tomato Dal",
        "Chilli potato",
        "Brinjal curry",
        "Salad",
        "Onion raita",
        "Drink: Sweet Lassi",
      ]),
    ],
  },
  // thursday (4)
  {
    day: 4,
    meals: [
      createMeal("breakfast", [
        "Pesarattu",
        "Ravva upma",
        "Groundnut Chutney",
        "Corn Flakes",
        "Puliyinchi",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Mudda Pappu",
        "Pachi Pulusu",
        "Potato 65",
        "Curd",
        "Koottu curry",
        "Tomato chilli chutney",
        "Salad",
        "Fruit: Watermelon",
        "Drink: Buttermilk",
      ]),
      createMeal("snacks", [
        "Masala Puri Chaat",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Egg fried Rice",
        "Veg fried rice",
        "Masala onion gravy",
        "Roti",
        "Green peas masala",
        "Onion raita",
        "Salad",
        "Drink: Passion Fruit",
      ]),
    ],
  },
  // friday (5)
  {
    day: 5,
    meals: [
      createMeal("breakfast", [
        "Pav Bhaji",
        "Lemons",
        "Onions",
        "Uggani (Puffed rice)",
        "Roasted chana Podi",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Ghee rice",
        "Chicken Roast (dry)",
        "Kadai Paneer",
        "Vegetable Raita",
        "Salad",
        "Drink: Pineapple/Mango drink",
      ]),
      createMeal("snacks", ["Samosa", "Bread", "Jam", "Butter", "Tea", "Milk"]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Aloo matar",
        "Spicy Dal Tadka",
        "Ivy Gourd Fry",
        "Kanji",
        "Chammanthi",
        "Rasam",
        "Salad",
        "Sweet: Vermicelli Payasam",
      ]),
    ],
  },
  // saturday (6)
  {
    day: 6,
    meals: [
      createMeal("breakfast", [
        "Idli",
        "Podi Idly/Vermicelli upma",
        "Corn Flakes",
        "Coconut Chutney",
        "Sambar",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Kerala rice",
        "Roti",
        "Mudda Pappu",
        "Pachi pulusu",
        "Pulissery",
        "Cabbage thoran",
        "Chips",
        "Curd",
        "Salad",
        "Fruit: Watermelon",
      ]),
      createMeal("snacks", [
        "Bhel Puri",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Jeera Rice",
        "Rice",
        "Roti",
        "Small Soya curry",
        "Sambar",
        "Coriander tomato chutney",
        "Chips",
        "Curd",
        "Salad",
        "Fruit: Banana",
        "Sweet: Ada Payasam",
      ]),
    ],
  },
];

// get menu for a specific day
export const getMenuForDay = (dayOfWeek: number): DayMenu | undefined => {
  return MESS_MENU.find((menu) => menu.day === dayOfWeek);
};

// get current or next meal based on time
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

  // if no next meal today, get first meal of tomorrow
  if (!current && !next) {
    const tomorrowMenu = getMenuForDay((now.getDay() + 1) % 7);
    next = tomorrowMenu?.meals[0] || null;
  }

  return { current, next };
};

// get all meals for carousel with nearby context
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
