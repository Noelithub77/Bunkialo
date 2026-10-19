# Web login and navigation performance

## Confirmed scope

- Responsive login: desktop intro beside a compact form, single column on smaller screens **[chosen]**.
- Investigate slow web tab switching, improve measured bottlenecks, and deploy the web update.
- Preserve Android runtime compatibility, credentials, portal verification and user data.

## Progress

- Responsive login and web buttons implemented, including keyboard submission and verification.
- Production export, six viewport checks, login interactions, unit tests and focused lint passed.
- Navigation baseline: 15 switches take 9,577 ms; warm switches settle in 595-667 ms.
  Chromium reports 2,797 ms of main-thread task time across that sequence.
- The installed tab-view implementation animates programmatic navigation with a spring.
  Its `animationEnabled` option is independent of swipe gesture animation.
- Instant web tab clicks, with touch swiping retained **[chosen]**.
  Use the supported `animationEnabled: false` option only in the web navigator.

- Web tab links now use Expo Router's supported prefetch behavior to prepare screens
  offscreen before their first visit. The first-visit pause disappeared in the same fixture.
- Final desktop sample: 15 switches take 1,005 ms; individual switches settle in
  56-70 ms, with 524 ms of main-thread task time during the sequence.
- Actual emulated touch input still switches Dashboard to Timetable.
- TypeScript and focused lint pass. Full lint reports eight existing import-resolution
  errors for native `@expo/ui` widget entry points.

## Verification

Use the production web bundle with Playwright for responsive and interaction checks.
Measure identical tab-switch scenarios before and after changes. Run project checks,
commit only this task, deploy with the existing Cloudflare configuration, and verify
public assets and authenticated navigation separately.
