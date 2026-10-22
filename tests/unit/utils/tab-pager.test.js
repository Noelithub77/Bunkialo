import { expect, test } from "bun:test";
import fs from "node:fs";
import vm from "node:vm";

// Exercise the shipped adapter's actual event handlers without a native renderer.
const createPager = () => {
  const refs = [];
  const timers = [];
  const moves = [];
  const selections = [];
  const source = fs.readFileSync("node_modules/react-native-tab-view/lib/module/PagerViewAdapter.js", "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export function PagerViewAdapter", "function PagerViewAdapter");
  const animatedValue = () => ({ setValue() {}, addListener: () => "listener", removeListener() {} });
  const context = vm.createContext({
    React: {
      useRef: (value) => { const ref = { current: value }; refs.push(ref); return ref; },
      useState: (value) => [value, () => {}],
      useEffect() {}, useMemo: (callback) => callback(),
      Children: { map: (children, callback) => children.map(callback) },
      isValidElement: () => true,
    },
    Animated: {
      createAnimatedComponent: () => "Pager",
      add: () => 0,
      event: (_mapping, options) => (event) => options.listener(event),
    },
    Keyboard: { dismiss() {} }, Platform: { OS: "android" },
    StyleSheet: { create: (styles) => styles }, View: "View", ViewPager: "ViewPager",
    useLatestCallback: (callback) => callback,
    useAnimatedValue: animatedValue,
    _jsx: (type, props) => ({ type, props }),
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    clearTimeout() {},
  });
  vm.runInContext(source + "\n globalThis.adapter = PagerViewAdapter;", context);
  const pager = context.adapter({
    navigationState: { index: 2, routes: Array.from({ length: 5 }, (_, key) => ({ key: String(key) })) },
    onIndexChange: (index) => selections.push(index),
    children: (props) => props.render([{ key: "scene" }]),
  }).props;
  refs[1].current = { setPage: (index) => moves.push(index) };
  const state = (value) => pager.onPageScrollStateChanged({ nativeEvent: { pageScrollState: value } });
  const scroll = (position, offset) => pager.onPageScroll({ nativeEvent: { position, offset } });
  return { pager, state, scroll, moves, selections, flush: () => timers.splice(0).forEach((callback) => callback()) };
};

test("short intentional swipes advance in both directions after a native snap back", () => {
  for (const [position, offset, target] of [[2, 0.23, 3], [1, 0.77, 1]]) {
    const p = createPager();
    p.state("dragging"); p.scroll(position, offset); p.state("settling");
    p.scroll(2, 0); p.state("idle"); p.flush();
    expect(p.moves).toEqual([target]); expect(p.selections).toEqual([target]);
  }
});

test("small movements and already selected pages are never pulled to another page", () => {
  const small = createPager();
  small.state("dragging"); small.scroll(2, 0.1); small.state("idle"); small.flush();
  expect(small.moves).toEqual([]);
  const selected = createPager();
  selected.state("dragging"); selected.scroll(2, 0.3); selected.state("settling");
  selected.pager.onPageSelected({ nativeEvent: { position: 3 } });
  selected.state("idle"); selected.flush(); expect(selected.moves).toEqual([]);
});

test("a new gesture invalidates a delayed correction", () => {
  const p = createPager();
  p.state("dragging"); p.scroll(2, 0.3); p.state("idle"); p.state("dragging"); p.flush();
  expect(p.moves).toEqual([]);
});
