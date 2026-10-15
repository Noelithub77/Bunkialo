import { bindings, defineConfig, defineWorker, exports } from "cf/config";

import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

const worker = defineWorker({
  name: "bunkialo",
  entrypoint,
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
});

export default defineConfig({
  worker: {
    ...worker,
    env: {
      ASSETS: bindings.assets(),
      USER_SESSION: bindings.durableObject({
        worker,
        exportName: "UserSession",
      }),
      DESKTOP_DIRECTORY: bindings.durableObject({
        worker,
        exportName: "DesktopDirectory",
      }),
      ATTENDANCE_PORTAL_URL: bindings.text("https://attendance.iiitkottayam.ac.in"),
      VAPID_ADMIN_CONTACT: bindings.text("mailto:noelmcv7@gmail.com"),
      VAPID_PRIVATE_KEY: bindings.secret(),
    },
    observability: { enabled: true, logs: { headSamplingRate: 1 } },
  },
});
