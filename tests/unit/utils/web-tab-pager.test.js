import { expect, test } from "bun:test";
import fs from "node:fs";
import vm from "node:vm";

function createPager() {
  const effects = [];
  const listeners = new Map();
  const timers = new Map();
  const selections = [];
  let timerId = 0;
  let animationCount = 0;
  let observeRemoval;
  class TouchTarget { isConnected = true; }
  const target = new TouchTarget();
  const value = {
    _value: -1170, _offset: 0,
    setValue(next) { this._value = next; },
    setOffset(next) { this._offset = next; },
    flattenOffset() { this._value += this._offset; this._offset = 0; },
    stopAnimation() {}, interpolate: () => 0,
  };
  const source = fs.readFileSync("node_modules/react-native-tab-view/lib/module/PanResponderAdapter.js", "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace("export function PanResponderAdapter", "function PanResponderAdapter");
  const context = vm.createContext({
    Node: TouchTarget, document: {},
    MutationObserver: class {
      constructor(callback) { observeRemoval = callback; }
      observe() {} disconnect() {}
    },
    React: {
      useRef: (current) => ({ current }), useMemo: (callback) => callback(),
      useEffect: (callback) => effects.push(callback), useLayoutEffect: (callback) => effects.push(callback),
      Children: { map: (children, callback) => children.map(callback) },
    },
    Animated: {
      Value: class {}, View: "Sheet", multiply: () => 0, divide: () => 0,
      spring: (_value, config) => { animationCount++; return { config }; },
      parallel: (animations) => ({ start: (callback) => { value.setValue(animations[0].config.toValue); callback({ finished: true }); } }),
    },
    PanResponder: { create: (handlers) => ({ panHandlers: handlers }) },
    StyleSheet: { create: (styles) => styles }, Keyboard: { dismiss() {} }, View: "Scene",
    useLatestCallback: (callback) => callback, useAnimatedValue: () => value,
    _jsx: (type, props) => ({ type, props }),
    window: {
      addEventListener: (event, callback) => listeners.set(event, callback),
      removeEventListener: (event) => listeners.delete(event),
    },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(source + "\nglobalThis.render = PanResponderAdapter;", context);
  const pager = context.render({
    layout: { width: 390, height: 844 },
    navigationState: { index: 3, routes: Array.from({ length: 5 }, (_, key) => ({ key: String(key) })) },
    onIndexChange: (index) => selections.push(index), children: ({ render }) => render([]),
  }).props;
  const cleanups = effects.map((effect) => effect());
  const gesture = { dx: -140, dy: 0, vx: -0.5, vy: 0, numberActiveTouches: 1 };
  const start = () => { pager.onPanResponderGrant({ nativeEvent: { target } }, gesture); pager.onPanResponderMove({}, gesture); };
  const release = () => pager.onPanResponderRelease({}, gesture);
  const terminal = (event) => { listeners.get(event)?.(); [...timers.values()].forEach((callback) => callback()); timers.clear(); };
  return { start, release, terminal, selections, value, animations: () => animationCount, removeTarget: () => { target.isConnected = false; observeRemoval?.(); }, unmount: () => cleanups.forEach((cleanup) => cleanup?.()), listeners };
}

for (const event of ["pointerup", "touchend", "touchcancel", "blur"]) {
  test(`web pager settles when ${event} arrives after the touched scene disappears`, () => {
    const pager = createPager();
    pager.start();
    pager.terminal(event);
    expect(pager.value._offset).toBe(0);
    expect(pager.value._value).toBe(-1560);
    expect(pager.selections).toEqual([4]);
  });
}

test("normal releases are not repeated by the browser fallback", () => {
  const pager = createPager();
  pager.start(); pager.release(); pager.terminal("pointerup");
  expect(pager.selections).toEqual([4]);
});

test("web pager removes browser listeners on unmount", () => {
  const pager = createPager();
  pager.unmount();
  expect(pager.listeners.size).toBe(0);
});


test("removing the touched node settles without waiting for a release that cannot bubble", () => {
  const pager = createPager();
  pager.start(); pager.removeTarget();
  expect(pager.value._offset).toBe(0);
  expect(pager.value._value).toBe(-1560);
  expect(pager.selections).toEqual([4]);
});


test("swipe release respects disabled tab animations and commits selection immediately", () => {
  const pager = createPager();
  pager.start(); pager.release();
  expect(pager.animations()).toBe(0);
  expect(pager.selections).toEqual([4]);
});
