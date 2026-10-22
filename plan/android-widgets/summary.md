# Android widgets and 1.5.1 release

## Final decisions

- Bunkialo gradients [chosen]: course and meal accents over a black gradient in dark mode and a pale neutral gradient in light mode. Centered, responsive content shows one upcoming item and its time.
- Whole-widget taps open the matching Mess or Timetable tab [chosen], preserving the destination through login. Use Expo Widgets TSX layouts and a typed configuration plugin.
- Vercel tracks `main` for production [chosen]. The filtered-checkout path check and landing build dependency issue are fixed; the live landing page returned 200.

## Implementation

- Cached, dependency-free gradient PNGs provide the widget backgrounds. Empty timetable states distinguish signed-out users from an empty week. Midnight joins class and meal refresh boundaries.
- Native previews follow light/dark appearance; resize dimensions are bounded and long menus stay within Glance container limits. Native widget registry inputs include app-owned sources to avoid stale incremental bundles.
- Release-only failures required preserving WorkManager constructors and Glance class names. Peek 0.3.0 validates built-in nodes by the `androidx.glance.` class-name prefix; this was confirmed in the installed bytecode and upstream source.
- Earlier feedback, gesture, notification and attendance changes are published through direct CLI updates for all four installed runtimes. Native 1.5.1 uses `1.5.1-sdk58-widgets-pdf-v1`; existing installations retain their compatible runtimes.

## Verification and release

- Typecheck, lint and 109 unit tests pass. Lint retains existing warnings. Twenty serialized widget checks cover selection, rollover, colours, gradients, empty states and responsive sizes.
- The optimised local release APK passed with two workers, two CPU cores, a 2 GB Java heap and Kotlin compilation in-process. The emulator remained running. Glance and InputMerger error logs are empty.
- Android emulator pixels verified dark/light meal and class cards with real test-account timetable data, compact/expanded placements, matching tap destinations and a quarter-screen tab swipe. These are emulator checks; physical-phone gesture feel remains unverified.
- Production workflow `39767078110` succeeded from code commit `c5e0044`. Its exact bundle identifies Android 1.5.1 (68), with runtime `1.5.1-sdk58-widgets-pdf-v1`. An emulator-signed APK generated from that bundle renders the widgets and final dark picker previews correctly.
- EAS submission `9e2bcc1e-86cd-4bf7-b533-004db08c0436` completed. A fresh Play readback shows production release `1.5.1`, version code `68`, status `completed`. Consumer-facing store availability was not independently checked.
- Release: https://github.com/Noelithub77/Bunkialo/releases/tag/v1.5.1(68)
- Evidence, screenshots, bundle checksum, manifest and Play readback: `artifacts/android-151/`. Native widget code is separate from the already published compatible JavaScript updates.

## Primary guidance

- https://docs.expo.dev/versions/latest/sdk/widgets/
- https://developer.android.com/docs/quality-guidelines/widget-quality
- https://developer.android.com/develop/ui/views/appwidgets/layouts
- https://developer.android.com/develop/ui/compose/glance/user-interaction
- https://github.com/jakex7/peek/blob/main/peek-emittables/src/main/kotlin/io/github/jakex7/peek/emittables/EmittableTree.kt
