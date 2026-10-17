# Google Play screenshots

The English listing screenshots live in `play-store/en-US/images/`, using the
`gplay images` directory layout. Numbered filenames define upload order.

The seven phone screenshots come from the October 16, 2026 landing-page captures
in `bunkialo-landing/public/media/`, converted from WebP to opaque PNG at their
original 540×1170 resolution. They show dashboard, attendance, timetable, mess,
academic calendar, grade calculator, and faculty, in that order. These captures
use the landing page's demo data; they are not new native phone captures.

The six Wear screenshots are native 480×480 captures from the Wear OS emulator
on October 17, 2026: Monday and Tuesday classes, a Thursday lab, and Saturday's
snacks, breakfast, and expanded dinner details.
They have no added device frames, masks, or transparency. Do not use the landing
page's 320×320 Wear posters for Play; the minimum is 384×384.

The listing icon and feature graphic are managed separately and were preserved.
The shared listing description is tracked in `en-US/full-description.txt`.
Wear release notes and signing guidance are in [wear-release.md](wear-release.md).

For a screenshot refresh, create an edit for `com.codialo.Bunkialo2`, back up the
current media with `gplay images pull`, and inspect the replacement files.
Use `gplay images delete-all` only for screenshot categories being replaced,
then upload the numbered files sequentially with `gplay images upload`. Read
back each category and compare ordered SHA-256 hashes before committing.

The installed CLI's `images plan` currently requests the unsupported
`promoGraphic` image type and returns a Google API error. Use category-specific
commands until that issue is fixed. A media pull may download resized image
previews, so retain the uploaded originals here for future reuse.

Keep the same edit until its commit succeeds. Creating another edit with the same
account discards the pending edit, so create a readback edit only after a successful
commit.

Use the commit mode required by Google's current response. If it says changes
cannot be sent automatically, commit with `--changes-not-sent-for-review` and
finish in Play Console. If it says changes are sent automatically and that the
parameter must not be set, omit that flag. A successful commit still does not
establish approval or public availability.

[Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
