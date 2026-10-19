# Web browser checks

Run against a server serving the production web export. For a local Worker with
that export, use `bun run worker:dev --port 8091` in another terminal.

```bash
WEB_LOGIN_TEST_URL=http://localhost:8091 bun run test:e2e:web-login
WEB_NOTICE_TEST_URL=http://localhost:8091 bun run test:e2e:web-notice
WEB_NAV_TEST_URL=http://localhost:8091 bun run test:e2e:web-navigation
WEB_NAV_TEST_URL=http://localhost:8091 WEB_NAV_WIDTH=390 WEB_NAV_HEIGHT=844 bun run test:e2e:web-navigation
```

These checks use isolated browser contexts and intercept API requests with synthetic
responses. They never authenticate a real account. Screenshots and measurements
are saved under ignored `artifacts/playwright/` paths.

The login check covers six viewport sizes, page spacing, overflow, password
visibility, loading, errors, Enter submission and portal verification.

The navigation check measures actual tab clicks until the destination heading
stops moving for three animation frames. It records first visits, two rounds of
repeat visits and Chromium main-thread task time, then tests a touch swipe from
Dashboard to Timetable. `WEB_NAV_MAX_SWITCH_MS` overrides the default 300 ms repeat
switch budget. `WEB_NAV_OUTPUT` selects the JSON report path. Keep viewport,
fixture, browser and build mode identical when comparing reports. These results
do not measure campus API latency or physical-device performance.

The notice check opens an unseen announcement in a fresh fixture at six viewport
sizes. It checks the 520 px width limit, centering, short-screen scrolling,
light and dark appearances, button/backdrop/Escape dismissal and persistence
of the existing seen state after reload. It never resets a real account's notices.
