# Shared assets

Screenshots, recordings, artwork, fonts, and app icons live here.

- `landing/`: the landing page’s static files, including screenshots and videos in `media/`, fonts and their licenses, branding, and public metadata. Vite serves this directory at the site root and copies it into the build without changing filenames.
- `play-store/en-US/images/`: ordered phone and Wear OS screenshots for Google Play. Listing text and upload guidance remain in `../play-store/`.
- `icons/` and `images/`: Expo app artwork, launcher icons, and splash images.
- `readme/`: generated illustrations and badges for the repository README.
- Root PNG files: companion screenshots used by the README.

Android resources required by the watch build remain under `wear-os/app/src/main/res/`.
