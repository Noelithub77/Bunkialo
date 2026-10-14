import { describe, expect, test } from "bun:test";
import {
  getCurrentMeal,
  getMenuForDay,
  getNearbyMeals,
  MEAL_TIMES,
  MESS_MENU,
} from "@/data/mess";
import { buildMessWidgetProps } from "@/widgets/data";

// Transcribed from the supplied October 2026 mess notice; Sunday = 0.
// Pipes separate dishes, not alternatives listed together on the notice.
const expectedDays = [
  [
    "Puri Masala|Pongal|Groundnut podi|Boiled Egg|Sprouts|Banana|Bread (Normal/Brown)|Jam|Tea|Milk",
    "Kerala rice|Rice|Roti|Carrot cabbage chana thoran|Onion Dal Tadka|Rasam|Curd|Coriander Tomato chutney|Salad|Drink: Sweet Lassi",
    "Sweet Naan|Bread|Jam|Butter|Tea|Milk",
    "Chicken Biryani|Paneer Biryani|Veg Gravy|Chicken Gravy|Onion Chilli Raita|Papad|Salad|Drink: Tang",
  ],
  [
    "Dosa|Medu vada|Aloo masala|Sambar|Coconut Chutney|Bread (Normal/Brown)|Jam|Butter|Tea|Milk",
    "Kerala rice|Roti|Parippu dal|Beans Poriyal|Rasam|Kondattam|Chips|Salad|Puliyinchi|Curd|Fruit: Watermelon",
    "Cream bun|Bread|Jam|Butter|Coffee|Milk",
    "Rice|Roti|Boiled Egg|Tomato Chilli Gravy|Beetroot Thoran|Dal|Papad|Curd|Salad|Drink: Buttermilk",
  ],
  [
    "Vada Pav|Puttu|Channa Curry|Fried Chillies|Onions|Green Chutney|Red Powdered Chutney|Banana|Bread (Normal/Brown)|Jam|Butter|Coffee|Milk",
    "Rice|Kerala rice|Roti|Chicken masala curry|Paneer Butter masala|Vegetable Raita|Salad|Drink: Tang",
    "Pazhampuri|Bread|Jam|Butter|Tea|Milk",
    "Rice|Roti|Rajma curry|Onion Dal Tadka|Bottle gourd stir fry|Rasam|Chips|Salad|Curd|Drink: Buttermilk",
  ],
  [
    "Idli|Masala Idli|Punugulu|Sambar|Groundnut Chutney|Tomato chutney|Bread (Normal/Brown)|Jam|Butter|Tea|Milk",
    "Roti|Rice|Onion Dal Tadka|Kerala rice|Soya chunks dry|Pulissery|Pachi pulusu|Curd|Salad|Sweet: Vermicelli Kesari",
    "Sweetcorn (boiled)|Bread|Jam|Butter|Tea|Milk",
    "Rice|Roti|Tomato Dal|Chilli potato|Brinjal curry|Salad|Onion raita|Drink: Sweet Lassi",
  ],
  [
    "Pesarattu|Ravva upma|Groundnut Chutney|Corn Flakes|Puliyinchi|Bread (Normal/Brown)|Jam|Butter|Tea|Milk",
    "Rice|Roti|Mudda Pappu|Pachi Pulusu|Potato 65|Curd|Koottu curry|Tomato chilli chutney|Salad|Fruit: Watermelon|Drink: Buttermilk",
    "Masala Puri Chaat|Bread|Jam|Butter|Coffee|Milk",
    "Egg fried Rice|Veg fried rice|Masala onion gravy|Roti|Green peas masala|Onion raita|Salad|Drink: Passion Fruit",
  ],
  [
    "Pav Bhaji|Lemons|Onions|Uggani (Puffed rice)|Roasted chana Podi|Bread (Normal/Brown)|Jam|Butter|Coffee|Milk",
    "Ghee rice|Chicken Roast (dry)|Kadai Paneer|Vegetable Raita|Salad|Drink: Pineapple/Mango drink",
    "Samosa|Bread|Jam|Butter|Tea|Milk",
    "Rice|Roti|Aloo matar|Spicy Dal Tadka|Ivy Gourd Fry|Kanji|Chammanthi|Rasam|Salad|Sweet: Vermicelli Payasam",
  ],
  [
    "Idli|Podi Idly/Vermicelli upma|Corn Flakes|Coconut Chutney|Sambar|Bread (Normal/Brown)|Jam|Butter|Coffee|Milk",
    "Rice|Kerala rice|Roti|Mudda Pappu|Pachi pulusu|Pulissery|Cabbage thoran|Chips|Curd|Salad|Fruit: Watermelon",
    "Bhel Puri|Bread|Jam|Butter|Coffee|Milk",
    "Jeera Rice|Rice|Roti|Small Soya curry|Sambar|Coriander tomato chutney|Chips|Curd|Salad|Fruit: Banana|Sweet: Ada Payasam",
  ],
];
const mealTypes = ["breakfast", "lunch", "snacks", "dinner"] as const;
const expectedTimes = {
  breakfast: { start: "07:00", end: "09:30", name: "Breakfast" },
  lunch: { start: "12:00", end: "14:30", name: "Lunch" },
  snacks: { start: "16:00", end: "18:00", name: "Snacks" },
  dinner: { start: "19:00", end: "20:30", name: "Dinner" },
};

describe("October 2026 mess notice", () => {
  test("contains every dish for all seven days and four meals", () => {
    expect(MESS_MENU.map((day) => day.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const [day, meals] of expectedDays.entries()) {
      expect(getMenuForDay(day)?.meals).toEqual(
        meals.map((items, index) => ({
          type: mealTypes[index],
          name: expectedTimes[mealTypes[index]].name,
          items: items.split("|"),
          startTime: expectedTimes[mealTypes[index]].start,
          endTime: expectedTimes[mealTypes[index]].end,
        })),
      );
    }
    expect(MEAL_TIMES).toEqual(expectedTimes);
  });

  test("desktop export stays in sync with the shared menu", async () => {
    const exportedMenu: unknown = await Bun.file(
      new URL("../../../omarchy-plugin/data/mess-menu.json", import.meta.url),
    ).json();
    expect(exportedMenu).toEqual(MESS_MENU);
  });

  test("ends breakfast and dinner at the new serving cutoffs", () => {
    expect(getCurrentMeal(new Date(2026, 9, 12, 9, 29)).current?.type).toBe(
      "breakfast",
    );
    expect(getCurrentMeal(new Date(2026, 9, 12, 9, 30)).current).toBeNull();
    expect(getCurrentMeal(new Date(2026, 9, 12, 9, 30)).next?.type).toBe(
      "lunch",
    );
    expect(getNearbyMeals(new Date(2026, 9, 12, 9, 30)).initialIndex).toBe(1);
    expect(getCurrentMeal(new Date(2026, 9, 12, 20, 29)).current?.type).toBe(
      "dinner",
    );
    const afterDinner = getCurrentMeal(new Date(2026, 9, 12, 20, 30));
    expect(afterDinner.current).toBeNull();
    expect(afterDinner.next).toEqual(getMenuForDay(2)?.meals[0] ?? null);
    expect(getCurrentMeal(new Date(2026, 9, 17, 20, 30)).next).toEqual(
      getMenuForDay(0)?.meals[0] ?? null,
    );
  });

  test("widgets expose all updated dishes and serving times", () => {
    const { cards } = buildMessWidgetProps();
    expect(cards).toHaveLength(28);
    for (const [day, meals] of expectedDays.entries()) {
      for (const [index, items] of meals.entries()) {
        const card = cards.find(
          (entry) => entry.id === `${day}-${mealTypes[index]}`,
        );
        expect(card?.items).toEqual(items.split("|"));
        expect(card?.time).toBe(
          ["7am–9:30am", "12pm–2:30pm", "4pm–6pm", "7pm–8:30pm"][index],
        );
      }
    }
  });
});
