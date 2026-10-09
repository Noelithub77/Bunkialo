import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
  worker: {
    name: "bunkialo",
    entrypoint: "./worker/index.ts",
    compatibilityDate: "2026-08-11",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: true,
    domains: ["bunkialo.allpyq.in"],
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: true,
    },
    // Keep the existing class names and SQLite storage for both namespaces.
    exports: {
      UserSession: exports.durableObject({ storage: "sqlite" }),
      DesktopDirectory: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      ASSETS: bindings.assets(),
      USER_SESSION: bindings.durableObject({
        worker: "bunkialo",
        exportName: "UserSession",
      }),
      DESKTOP_DIRECTORY: bindings.durableObject({
        worker: "bunkialo",
        exportName: "DesktopDirectory",
      }),
      ATTENDANCE_PORTAL_URL: bindings.text("https://attendance.iiitkottayam.ac.in"),
      VAPID_ADMIN_CONTACT: bindings.text("mailto:noelmcv7@gmail.com"),
    },
    observability: { enabled: true, logs: { headSamplingRate: 1 } },
  },
});
