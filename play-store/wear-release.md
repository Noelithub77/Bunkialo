# Wear OS Play release

`en-US/full-description.txt` is the shared English store description, including
Wear OS tile and watch face complication features. Preserve the phone description
when updating it. The listing is shared with the phone app.

The Wear startup theme uses the round Bunkialo launcher artwork directly,
configured at 48×48dp on black, with
`installSplashScreen()` called before `super.onCreate()` in `MainActivity`.
See [Google's Wear splash screen implementation](https://developer.android.com/training/wearables/apps/splash-screen)
and [Wear app quality requirements](https://developer.android.com/docs/quality-guidelines/wear-app-quality).

Build from `wear-os/` with `./gradlew :app:bundleRelease`. Release signing requires
the four `NEAROS_EAS_*` variables documented in `../wear-os/AGENTS.md`. Never commit signing
credentials. Increment the Wear version code for every new upload.

Use the installed `gplay` CLI to create an edit for `com.codialo.Bunkialo2`, inspect
all tracks and listings, upload the signed bundle, patch the English full
description, and replace the rejected version on every affected `wear:*` track.
Keep phone tracks unchanged. Validate the edit before committing it for review,
and read back the tracks and listing in a fresh edit after committing.

If Google returns "Changes cannot be sent for review automatically", commit with
`--changes-not-sent-for-review`, then use Publishing overview in Play Console to
send the saved changes for review. This is a server restriction; saving the edit
does not submit it.

Useful command help:

```sh
gplay edits create --help
gplay bundles upload --help
gplay listings patch --help
gplay tracks update --help
gplay edits validate --help
gplay edits commit --help
```

A completed track release returned by the publishing API does not establish policy
approval or public availability. Check the review outcome in Play Console.
