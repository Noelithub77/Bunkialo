import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

// Run the same serialized layouts and interaction runtime shipped in native widgets.
const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), "bunkialo-widget-check-"));
let checks = 0;
const card = (id, day, startMinute, name) => ({
  id,
  day,
  startMinute,
  endMinute: startMinute + 60,
  name,
  time: "9am–10am",
  color: "#A78BFA",
  lightBackground: "#f0eafb",
  darkBackground: "#342d45",
  items: [],
});
const classes = {
  cards: [
    card("1", 4, 540, "Algorithms"),
    card("2", 4, 630, "Physics"),
    card("3", 5, 540, "Design"),
  ],
  page: 0,
  anchor: 0,
  utcOffsetMinutes: 330,
};
const nodes = (tree) => [
  tree,
  ...[tree?.props?.children]
    .flat(Infinity)
    .filter((child) => child && typeof child === "object")
    .flatMap(nodes),
];
const texts = (tree) =>
  nodes(tree)
    .filter((node) => node.type === "TextView")
    .map((node) => node.props.text);

try {
  for (const platform of ["android"]) {
    const bundle = path.join(output, `${platform}.bundle`);
    const registryFile = path.join(output, `${platform}.json`);
    for (const [script, file] of [
      ["build-bundle.mjs", bundle],
      ["build-layout-registry.mjs", registryFile],
    ]) {
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/expo-widgets/scripts", script),
          root,
          platform,
          file,
        ],
        { stdio: "inherit" },
      );
    }
    let timestamp = Date.parse("2026-10-01T03:45:00Z");
    class WidgetDate extends Date {
      static now() {
        return timestamp;
      }
    }
    const context = vm.createContext({ console, Date: WidgetDate });
    vm.runInContext(fs.readFileSync(bundle, "utf8"), context);
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8")).widgets;
    const environment = (
      colorScheme = "light",
      widgetFamily = "systemSmall",
    ) => ({
      colorScheme,
      widgetFamily,
      ...(platform === "ios" ? { timestamp } : {}),
    });
    const render = (props, scheme = "light", family = "systemSmall") =>
      context.__expoWidgetRender(props, environment(scheme, family));
    const load = (name) => {
      context.__expoWidgetLayout = vm.runInContext(
        `(${registry[name].layout})`,
        context,
      );
    };
    load("BunkialoTimetable");
    assert.ok(
      texts(render(registry.BunkialoTimetable.initialProps)).includes(
        "Timetable",
      ),
    );
    checks++;
    assert.ok(texts(render(classes)).includes("Physics"));
    assert.ok(!texts(render(classes)).includes("Algorithms"));
    checks++;
    assert.equal(nodes(render(classes)).filter((node) => node.props?.target).length, 0);
    checks++;
    assert.notEqual(JSON.stringify(render(classes)), JSON.stringify(render(classes, "dark")));
    checks++;
    timestamp = Date.parse("2026-10-01T05:01:00Z");
    assert.ok(texts(render(classes)).includes("Design"));
    checks++;
    const forbidden = new Set(["Now", "Next", "Today", "Tomorrow", "Next meal", "Next class", "After this"]);
    assert.ok(texts(render(classes)).every((text) => !forbidden.has(text)));
    checks++;
    load("BunkialoMess");
    const meals = registry.BunkialoMess.initialProps;
    timestamp = Date.parse("2026-10-01T03:00:00Z");
    const nextMeal = texts(render(meals));
    assert.ok(nextMeal.includes("Lunch"));
    assert.ok(!nextMeal.includes("Breakfast"), "An ongoing meal must not replace the next meal");
    checks++;
    assert.ok(nextMeal.some((text) => meals.cards.some((card) => card.items.includes(text))));
    checks++;
    assert.equal(nodes(render(meals)).filter((node) => node.props?.target).length, 0);
    assert.deepEqual(texts(render({ ...meals, page: 20, anchor: 123 })), nextMeal);
    checks++;
    timestamp = Date.parse("2026-10-01T04:15:00Z");
    assert.ok(texts(render(meals)).includes("Lunch"));
    checks++;
    timestamp = Date.parse("2026-10-01T06:30:00Z");
    assert.ok(texts(render(meals)).includes("Snacks"), "Advance when the next meal begins");
    checks++;
    timestamp = Date.parse("2026-10-01T15:30:00Z");
    const tomorrowMeal = texts(render(meals));
    assert.ok(tomorrowMeal.includes("Breakfast") && tomorrowMeal.every((text) => !text.includes("Tomorrow")));
    checks++;
    const expandedMeals = texts(context.__expoWidgetRender(meals, { ...environment(), width: 300, height: 280 }));
    assert.ok(expandedMeals.filter((text) => meals.cards.some((card) => card.items.includes(text))).length > 3);
    checks++;
    for (const height of [180, 280, 400]) {
      const longMenu = { ...meals, cards: meals.cards.map((card) => ({ ...card, items: Array.from({ length: 12 }, (_, index) => `Menu item ${index + 1}`) })) };
      const tree = context.__expoWidgetRender(longMenu, { ...environment(), width: 300, height });
      for (const node of nodes(tree).filter((node) => ["ColumnView", "RowView", "BoxView"].includes(node.type))) {
        assert.ok([node.props.children].flat(Infinity).filter(Boolean).length <= 10, "Glance containers support at most ten children");
      }
    }
    checks++;
    const allowed = new Set(["ColumnView", "RowView", "TextView"]);
    for (const name of ["BunkialoMess", "BunkialoTimetable"]) {
      load(name);
      const props = name === "BunkialoMess" ? meals : classes;
      for (const [width, height] of [[150, 100], [150, 140], [180, 180], [300, 220], [300, 340], [500, 200]]) {
        const tree = context.__expoWidgetRender(props, { ...environment(), width, height });
        assert.ok(nodes(tree).every((node) => allowed.has(node.type)));
        assert.ok(texts(tree).every((text) => !forbidden.has(text)));
      }
      checks++;
    }
    console.log(`${platform}: widget rendering, selection and sizes passed`);
  }
  console.log(`${checks} native widget checks passed`);
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
