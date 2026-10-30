import { expect, test } from "bun:test";
import fs from "node:fs";
import vm from "node:vm";
import { useGestureUiStore } from "../../../src/stores/gesture-ui-store";

// Run the real hook and both carousels' JSX handlers with native event ordering.
function createCarousel(kind = "meal") {
  const focusEffects = [];
  const jsx = (type, props) => ({ type, props });
  const context = vm.createContext({
    useRef: (current) => ({ current }),
    useState: (value) => [typeof value === "function" ? value() : value, () => {}],
    useEffect() {},
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useFocusEffect: (callback) => focusEffects.push(callback),
    useGestureUiStore,
    useColorScheme: () => "dark", Colors: { dark: {}, light: {}, status: {} },
    getNearbyMeals: () => ({ meals: [{ type: "breakfast" }], initialIndex: 0 }),
    useBunkStore: (selector) => selector({ courses: [] }),
    getNearbySlots: () => [{ id: "slot", dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }],
    View: "View", Text: "Text", Pressable: "Pressable", FlatList: "FlatList",
    jsxDEV: jsx,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  const evaluate = (file) => {
    const source = new Bun.Transpiler({ loader: "tsx" }).transformSync(fs.readFileSync(file, "utf8"))
      .replace(/^import[\s\S]*?from ["'][^"']+["'];?\n/gm, "")
      .replace(/export function /g, "function ")
      .replace(/jsxDEV_[a-z0-9]+/g, "jsxDEV");
    vm.runInContext(source, context);
  };
  evaluate("src/hooks/use-carousel-gesture.ts");
  evaluate(kind === "meal" ? "src/components/mess/meal-carousel.tsx" : "src/components/timetable/upnext-carousel.tsx");
  const tree = kind === "meal" ? context.MealCarousel() : context.UpNextCarousel({ slots: [] });
  const list = tree.props.children.find((child) => child?.type === "FlatList");
  const focusCleanups = focusEffects.map((effect) => effect());
  return { props: list.props, blur: () => focusCleanups.forEach((cleanup) => cleanup?.()) };
}

for (const kind of ["meal", "timetable"]) {
  test(`${kind} carousel releases tab swiping on finger lift even if momentum never ends`, () => {
    const c = createCarousel(kind);
    c.props.onTouchStart();
    c.props.onScrollBeginDrag();
    expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(true);
    c.props.onScrollEndDrag({ nativeEvent: { velocity: { x: 1 } } });
    c.props.onTouchEnd();
    expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(false);
    // A late momentum callback must not lock tabs again.
    c.props.onMomentumScrollEnd();
    expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(false);
  });

  for (const end of ["cancel", "blur"]) {
    test(`${kind} carousel releases tab swiping on ${end}`, () => {
      const c = createCarousel(kind);
      c.props.onTouchStart(); c.props.onScrollBeginDrag();
      if (end === "cancel") c.props.onTouchCancel(); else c.blur();
      expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(false);
    });
  }
}

test("a carousel cannot disable an already moving tab pager", () => {
  const c = createCarousel();
  useGestureUiStore.getState().setTabSwipeActive(true);
  try {
    c.props.onTouchStart(); c.props.onScrollBeginDrag();
    expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(false);
  } finally {
    c.props.onTouchEnd();
    useGestureUiStore.getState().setTabSwipeActive(false);
  }
});

test("a hidden carousel cannot release another carousel's touch", () => {
  const meal = createCarousel();
  const timetable = createCarousel("timetable");
  meal.props.onTouchStart();
  timetable.props.onTouchStart();
  meal.blur();
  expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(true);
  timetable.props.onTouchCancel();
  expect(useGestureUiStore.getState().isHorizontalContentGestureActive).toBe(false);
});
