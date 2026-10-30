# Mess to Bunks gesture repair

- Scope: preserve the existing pager and carousel, fix gesture ownership, test Android and mobile web, push main, build and deploy through the existing release surfaces.
- Earlier fix: Android tab-view adapter patch guards moving pages and assists short swipes. Carousel ownership still starts on scroll and ends on momentum, allowing a stale lock after a cancelled scroll and blocking immediate tab swipes during momentum.
- Reproduction: on the isolated Android emulator, swipe the meal carousel, then immediately swipe left on the daily menu. The first tab swipe is ignored; a later swipe works. Standard and interrupted mobile Chromium swipes currently settle.
- Next: add an event-level regression for both carousel consumers, bind ownership to touch start/end/cancel and focus cleanup, then verify gestures and release outputs.

## Implemented and verified

- Carousel ownership now follows touch start, end, cancellation and focus cleanup. Each carousel has its own owner, and cannot disable a moving tab pager.
- The existing tab-view patch recovers web gestures when the touch target disappears or the browser delivers release, cancellation or blur outside the responder. It respects disabled tab animation.
- Regression tests reproduced both failures before the fixes in the initial investigation.
- `bun run test`: 126 passing tests in 30 files. `bun run typecheck`: passed. Frozen dependency installation: passed.
- Production web build: passed. Mobile Chromium (real CDP touch input) and WebKit (synthetic DOM touches): seven scenarios each passed. Artifacts: `artifacts/playwright/tab-gestures/`.
- Android debug build: successful. Fresh Metro app replay: all 40 steps passed; final screen visually checked as fully settled Attendance. Replay: `tests/e2e/android/tab-gestures.ad`; result: `artifacts/android-tab-gestures/replay-result.txt`.
- Repository lint remains blocked by eight pre-existing em-dash occurrences in six unrelated files. Focused lint using repository rules exits successfully with warnings.
- Physical Android and iPhone testing remains unverified. WebKit DOM input does not prove physical Safari gesture arbitration.

## Release

Push this fix to main, deploy the existing web Worker, and dispatch the existing Android production build and publish workflow. Verify remote status separately from dispatch.
