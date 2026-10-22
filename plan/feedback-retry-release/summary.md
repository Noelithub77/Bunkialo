# Feedback retry release

Published directly with EAS CLI on 22 October 2026. Each runtime was read back from the production update endpoint and returned the published update identifier.

| Runtime | Update group |
| --- | --- |
| 1.5.0-sdk58-widgets-pdf-v1 | 6e1d5603-a93a-49eb-80a3-4dcace055c78 |
| 1.5.0-sdk58-widgets-v1 | 7cf05180-99fd-4cfd-80c8-079d5dd6d67e |
| 1.4.1-sdk58-widgets-v1 | 6d570c72-da69-47f6-aa2e-02a8d352a431 |
| 1.4.1 | e30e4e93-e10a-4ccb-92e9-6d6e16a65a84 |

Source: `569d5e1`. Includes up to four feedback attempts with increasing delays, completion verification and fresh forms; sequential course submissions; shorter tab swipe acceptance on SDK 58; and the More menu layout. SDK 54 also receives the full-day duty-leave fixes.

Verification: 98 current unit tests and 82 prepared legacy tests pass. Typecheck passes; lint completes with existing warnings. Adapter event tests cover short swipes, native selections, small movements and interrupted corrections. Updated More screen inspected on Android. Latest physical swipe behavior remains to be checked in the isolated emulator. No additional feedback answers were submitted.

The widget native preview and size changes are separate work and are not part of these updates.
