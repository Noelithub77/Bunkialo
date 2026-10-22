# Android home widgets and 1.5.1 release

Single upcoming item per widget [chosen]. The user replaced the carousel request with a simple upcoming-meal widget using Expo SDK 58 `expo-widgets`. Show centered meal name, time chip and menu; show centered class name and time chip. Use a timetable graphic when height permits. Unsynced timetable opens the timetable instead of claiming there are no classes. Remove redundant next/today labels. Use discrete size breakpoints and bounded resize dimensions. No paging controls, counters, day lists or stacked cards. Tapping the whole widget opens its matching app tab [chosen]: Mess or Timetable, preserving the destination through login. The uncommitted native StackView experiment was removed.

- Earlier scrolling, notifications, feedback and attendance fixes were published directly through the CLI to all four installed runtimes and verified at Expo's production endpoint.
- Vercel uses `main` for production. Deployment `dpl_7BwQh56LRHvudMQH3SwbQEnGsMTo` succeeded; https://bunkialo2.vercel.app returned HTTP 200.
- Picker previews and adaptive dimensions require the new Android build. Existing installations keep their compatible runtime; 1.5.1 uses `1.5.1-sdk58-widgets-pdf-v1`.
- Native widget registry inputs include app widget sources to avoid stale incremental builds. Long menus stay below Glance's ten-child container limit.
- Fixed-palette run `39759536229` was canceled during build before submission when the user selected content-derived dynamic colours.
- The earlier 1.5.1 release workflow `39750375150` was canceled before building or submitting.
- Typed plugin configuration/prebuild, typecheck and lint pass. Eighteen serialized checks cover upcoming-item selection, stale paging state, rollover, supported components, container limits and six widget sizes plus accent contrast. Light native meal pixels and timetable sync from the real test account were verified. Timetable deep linking preserved the destination through sign-in. Release-build cold launches and replacement 1.5.1 build/Play submission are in progress.

- Whole-widget taps use native Glance `actionStartActivity` with explicit app launch intents and distinct deep-link data; the typed plugin supplies per-widget URLs through application metadata.

Content-derived dynamic colours [chosen]: the user explicitly rejected wallpaper colours. Course configuration drives class colour; meal category drives meal colour. Surfaces are derived from each seed, with black/white chip text selected by contrast.

## Primary guidance checked

- https://docs.expo.dev/versions/latest/sdk/widgets/ — `createWidget`, `widget` directive, TSX Expo UI components and supported Android modifiers. Android environment only documents `colorScheme`; the existing dimension bridge supplies actual width/height.
- https://developer.android.com/docs/quality-guidelines/widget-quality — rearrange useful content at size breakpoints, avoid linear text scaling, cap sizes that only add blank space, and provide accurate picker previews.
- https://developer.android.com/develop/ui/views/appwidgets/layouts — native responsive sizing and minimum/maximum resize dimensions.
- https://docs.expo.dev/config-plugins/plugins/ — typed config plugin conventions. Verified this erasable TypeScript plugin with the project's pinned Node 24 using actual Expo config and prebuild; no parser dependency was added.

- https://developer.android.com/develop/ui/compose/glance/user-interaction — native activity actions open the app directly without receiver/service trampolines.

## Final gradient revision

- Bunkialo gradients [chosen]: course and meal accents glow over a black gradient in dark mode and a pale neutral gradient in light mode. Content stays centered and tap destinations remain Mess and Timetable.
- Empty timetable text now distinguishes signed-out and no-class states; it no longer displays an action label as content. Midnight joins class and meal refresh boundaries.
- Optimised release verification exposed two native issues: WorkManager constructors removed by R8 and Peek rejecting renamed Glance node classes. The Expo build-properties configuration preserves those constructors and Glance class names. Peek 0.3.0 checks `node.javaClass.name.startsWith("androidx.glance.")`; verified against its compiled dependency and upstream source.
- Production run `39760709472` was canceled before release/submission so it cannot ship the superseded layout or native optimisation failure.
- Typecheck, lint and 109 unit tests pass; 20 serialized widget checks pass. Final release rebuild and on-device gradient verification are in progress, limited to two workers, two CPU cores and a 2 GB Java heap with Kotlin in-process. The emulator remains running.
