# Android home widgets

Adaptive pastel cards [chosen]: compact widgets show one current or next item; larger sizes reveal details. Add matching picker previews.

- Completed feedback, notification, scrolling and duty-leave changes are pushed; production updates were published directly with the CLI for all four installed runtimes and verified at Expo's production endpoint.
- The shipped widget bundle and embedded layouts render successfully in the serialized runtime. The picker has no preview and therefore displays the loading placeholder. Cold native rendering remains under test.
- Implemented picker previews, explicit initial sync placeholders, native size information and adaptive content. Removed unsupported weight modifiers. Sixteen serialized Android layout and paging checks pass.
- Android debug build passed (734 tasks). Serialized checks pass. Native preview resources are present in the APK. The local emulator repeatedly exited during visual inspection; cold rendering, controls, resize pixels and screenshots remain under verification.
- Preparing the user-requested Android 1.5.1 production build and Play submission. Native resources are separate from the already published JavaScript updates.

## Carousel follow-up

- Full-week paging replaces the five-item limit. Footer controls use explicit widths and bottom alignment because the Android bridge ignores Compose space-between and spaced-by arrangements.
- Menu rows use the widget height; larger cards show following items when space permits. Menus are grouped below Glance's ten-child container limit.
- Added app widget sources and menu data to the native registry task inputs so incremental builds cannot reuse obsolete layouts.
- Frozen install, 633 unit tests, typecheck and lint pass (existing lint warnings remain). Eighteen serialized widget checks cover full-week navigation, adaptive details and native container limits. Android debug build passes; cold Mess rendering and live button paging pass on the isolated emulator. Compact and timetable pixels remain under verification.
- Vercel main production deployment succeeded: dpl_7BwQh56LRHvudMQH3SwbQEnGsMTo, https://bunkialo2.vercel.app returns HTTP 200.
