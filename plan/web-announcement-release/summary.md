# Web announcements and v1.5 release notice

- **[chosen]** Anchor desktop announcements below the dashboard bell; use a bottom sheet on phones. Keep the bell inbox in the same position and width.
- Use the existing React Native, NativeWind, modal and scroll components. No new dependencies.
- Draft a new `bunkialo-v1-5-2026-10` notice with reusable linked highlights in the announcement and expanded inbox item. Preserve existing seen and dismissed state.
- Link widgets to PR #34, Wear OS improvements to PR #32, the CLI to PR #35, and the landing redesign to commit `75f7e6d`. The landing has no dedicated PR. Describe CLI and landing as later additions, rather than original v1.5 APK contents.
- Verify a local production export with isolated browser fixtures, including resize, short screens, source links, dismissal and persistence. Run type checking, focused lint and unit tests.
- Review gate requested by the user: present actual desktop/mobile screenshots and exact content before any push or deployment.

## Status

Implemented locally; awaiting the user's layout and copy review. Nothing from this change has been pushed or deployed.

The user's follow-up replaces the release star with an `Update` button opening the v1.5 release page. The duplicate footer release link is removed. The updated button and layout passed the same twelve browser cases, production export, TypeScript and focused lint (one existing effect warning).

## Verification

- Production web export and TypeScript check passed.
- All 85 unit tests passed.
- Both release and AllPYQ announcements passed the browser checks at 1920×1080, 1440×900, 768×1024 (light), 390×844, 320×568 and 844×390. Verified source links, resize alignment, bounded scrolling, dismissal, seen-state persistence and inbox reopening. Fixtures advance the notice retention date without replacing animation timers.
- Tab clicks remained around 65 ms in the local synthetic browser benchmark; touch swipe passed. This does not measure campus API latency or physical-device performance.
- Focused lint: no errors, one existing popup selection effect warning. Full-project lint remains blocked by eight existing `@expo/ui` widget import errors and reports 112 warnings.
- Desktop, phone, light-mode and expanded inbox captures are under ignored `artifacts/playwright/notice/`. Browser checks use synthetic API fixtures, not an authenticated production account. Native Android rendering/device behavior was not tested.
