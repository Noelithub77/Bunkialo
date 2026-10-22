import { expect, test } from "bun:test";
import fs from "node:fs";
import vm from "node:vm";
import { getRefreshGestureDirection } from "@/utils/refresh-gesture";

const createRefresh = () => {
  let calls = 0;
  let state = { isTabSwipeActive: false };
  let subscribe;
  const enabled = [];
  const store = Object.assign((select) => select(state), {
    getState: () => state,
    subscribe: (callback) => { subscribe = callback; return () => {}; },
  });
  const source = new Bun.Transpiler({ loader: "ts" }).transformSync(fs.readFileSync("src/hooks/use-directional-refresh.ts", "utf8")
    .replace(/^import[^\n]*;\n/gm, "").replace("export function", "function"));
  const context = vm.createContext({
    useGestureUiStore: store, getRefreshGestureDirection,
    useCallback: (callback) => callback, useEffect: (callback) => callback(),
    useRef: (current) => ({ current }), useState: (value) => [value, (next) => enabled.push(next)],
  });
  vm.runInContext(source + "\nglobalThis.create = useDirectionalRefresh;", context);
  const hook = context.create(() => { calls++; });
  return {
    hook, enabled, calls: () => calls,
    start: () => hook.touchHandlers.onTouchStart({ nativeEvent: { pageX: 100, pageY: 100 } }),
    move: (dx, dy) => hook.touchHandlers.onTouchMove({ nativeEvent: { pageX: 100 + dx, pageY: 100 + dy } }),
    swipe: (active) => { state = { isTabSwipeActive: active }; subscribe(state); },
  };
};

test("horizontal drift disables the indicator and blocks delayed refresh callbacks", () => {
  const p = createRefresh(); p.start(); p.move(60, 12); p.move(80, 100); p.hook.onRefresh();
  expect(p.enabled).toContain(false); expect(p.calls()).toBe(0);
});
test("a pager swipe cancels a potential pull even after the pager returns idle", () => {
  const p = createRefresh(); p.start(); p.move(2, 20); p.swipe(true); p.swipe(false); p.hook.onRefresh();
  expect(p.calls()).toBe(0);
});
test("a fresh vertical pull still refreshes exactly once", () => {
  const p = createRefresh(); p.start(); p.move(50, 3); p.hook.onRefresh();
  p.start(); p.move(3, 60); p.hook.onRefresh(); p.hook.onRefresh();
  expect(p.calls()).toBe(1);
});
