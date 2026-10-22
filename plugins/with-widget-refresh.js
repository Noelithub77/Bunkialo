const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = (config) =>
  withDangerousMod(config, [
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
            .replace('android:initialLayout="@layout/expo_widgets_initial_layout"',
              `android:initialLayout="@layout/bunkialo_${kind}_initial"\n  android:previewLayout="@layout/bunkialo_${kind}_preview"`),
        );
        const resources = path.dirname(root);
        await fs.mkdir(path.join(resources, "layout"), { recursive: true });
        await fs.mkdir(path.join(resources, "drawable"), { recursive: true });
        await fs.writeFile(path.join(resources, "drawable", `bunkialo_${kind}_surface.xml`),
          `<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="${kind === "mess" ? "#E4F0E7" : "#F1EBFC"}"/><corners android:radius="24dp"/></shape>`);
        const layout = (preview) => `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:padding="16dp"
  android:background="@drawable/bunkialo_${kind}_surface">
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content"
    android:text="${preview ? "Up next" : kind === "mess" ? "Mess" : "Timetable"}" android:textColor="#615A6C" android:textSize="12sp"/>
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp"
    android:text="${preview ? kind === "mess" ? "Lunch" : "Next class" : "Open Bunkialo to sync"}"
    android:textColor="#24202B" android:textStyle="bold" android:textSize="20sp" android:maxLines="2"/>
  <TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="6dp"
    android:text="${preview ? kind === "mess" ? "12pm–2:30pm" : "Your timetable, at a glance" : "Waiting for sync"}"
    android:textColor="#615A6C" android:textSize="12sp"/>
  ${preview && kind === "mess" ? '<TextView android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="10dp" android:text="Rice · Roti · Curry" android:textColor="#24202B" android:textSize="12sp"/>' : ""}
</LinearLayout>`;
        for (const preview of [false, true]) {
          await fs.writeFile(path.join(resources, "layout", `bunkialo_${kind}_${preview ? "preview" : "initial"}.xml`), layout(preview));
        }
      }
      return config;
    },
  ]);
