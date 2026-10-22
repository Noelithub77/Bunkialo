import type { ConfigPlugin } from "expo/config-plugins";

const { withAndroidManifest, withDangerousMod }: typeof import("expo/config-plugins") = require("expo/config-plugins");
const fs: typeof import("node:fs/promises") = require("node:fs/promises");
const path: typeof import("node:path") = require("node:path");

const withWidgetRefresh: ConfigPlugin = (config) => {
  const linked = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android application missing");
    const metadata = application["meta-data"] ?? [];
    application["meta-data"] = [
      ...metadata.filter((entry) => !entry.$["android:name"].startsWith("expo.modules.widgets.OPEN_URL.")),
      ...[["BunkialoMess", "mess"], ["BunkialoTimetable", "timetable"]].map(([name, route]) => ({
        $: { "android:name": `expo.modules.widgets.OPEN_URL.${name}`, "android:value": `bunkialo://${route}` },
      })),
    ];
    return config;
  });
  return withDangerousMod(linked, [
    "android",
    async (config) => {
      const root = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      for (const name of [
        "bunkialo_timetable_info.xml",
        "bunkialo_mess_info.xml",
      ]) {
        const file = path.join(root, name);
        const xml = await fs.readFile(file, "utf8");
        const period = /android:updatePeriodMillis\s*=\s*["']\d+["']/;
        if (!period.test(xml)) {
          throw new Error(`Widget refresh interval missing in ${name}`);
        }
        const kind = name.includes("timetable") ? "timetable" : "mess";
        await fs.writeFile(
          file,
          xml.replace(period, 'android:updatePeriodMillis="1800000"')
            .replace('android:resizeMode="', `android:minResizeWidth="150dp" android:minResizeHeight="${kind === "mess" ? 140 : 96}dp" android:maxResizeWidth="${kind === "mess" ? 520 : 420}dp" android:maxResizeHeight="${kind === "mess" ? 340 : 240}dp" android:resizeMode="`)
            .replace('android:initialLayout="@layout/expo_widgets_initial_layout"',
              `android:initialLayout="@layout/bunkialo_${kind}_initial"\n  android:previewLayout="@layout/bunkialo_${kind}_preview"`),
        );
        const resources = path.dirname(root);
        await fs.mkdir(path.join(resources, "layout"), { recursive: true });
        await fs.mkdir(path.join(resources, "drawable"), { recursive: true });
        for (const dark of [false, true]) {
          const drawable = path.join(resources, dark ? "drawable-night" : "drawable");
          const values = path.join(resources, dark ? "values-night" : "values");
          await fs.mkdir(drawable, { recursive: true });
          await fs.mkdir(values, { recursive: true });
          await fs.writeFile(path.join(drawable, `bunkialo_${kind}_surface.xml`),
            `<shape xmlns:android="http://schemas.android.com/apk/res/android"><gradient android:angle="315" android:startColor="${dark ? kind === "mess" ? "#20352D" : "#30283F" : kind === "mess" ? "#E1F1E9" : "#EEE7F9"}" android:endColor="${dark ? "#050505" : "#EFEFEF"}"/><corners android:radius="24dp"/></shape>`);
          await fs.writeFile(path.join(values, `bunkialo_${kind}_colors.xml`),
            `<resources><color name="bunkialo_${kind}_ink">${dark ? "#FAFAFA" : "#171717"}</color><color name="bunkialo_${kind}_muted">${dark ? "#A3A3A3" : "#525252"}</color></resources>`);
        }
        const layout = (preview: boolean) => `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:gravity="center" android:padding="16dp"
  android:background="@drawable/bunkialo_${kind}_surface">
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp"
    android:text="${preview ? kind === "mess" ? "Lunch" : "Your class" : kind === "mess" ? "Mess menu" : "Timetable"}"
    android:gravity="center" android:textColor="@color/bunkialo_${kind}_ink" android:textStyle="bold" android:textSize="28sp" android:maxLines="2"/>
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="6dp"
    android:text="${preview ? kind === "mess" ? "12pm–2:30pm" : "9am–10:30am" : kind === "mess" ? "Syncing menu" : "Syncing classes"}"
    android:gravity="center" android:textColor="@color/bunkialo_${kind}_muted" android:textSize="14sp"/>
  ${preview && kind === "mess" ? '<TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="10dp" android:text="Rice · Roti · Curry" android:gravity="center" android:textColor="@color/bunkialo_mess_muted" android:textSize="12sp"/>' : ""}
</LinearLayout>`;
        for (const preview of [false, true]) {
          await fs.writeFile(path.join(resources, "layout", `bunkialo_${kind}_${preview ? "preview" : "initial"}.xml`), layout(preview));
        }
      }
      return config;
    },
  ]);
};

module.exports = withWidgetRefresh;
