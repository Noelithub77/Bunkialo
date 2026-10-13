# CLI installation and releases

- **[chosen]** Publish a rolling `cli-latest` release after successful builds on main.
- **[chosen]** Use one shell installer for macOS/Linux and a PowerShell installer for Windows; offer the companion skill, then start browser login.
- **[chosen]** Put installation first in the README and use `LICENSE.md` for AGPL-3.0-only.
- Build native binaries for x64 and arm64 on all three operating systems, with the existing keyring dependency's native backends enabled.
- Verify checksums before installation, install without administrator privileges, and support unattended installation without skill or login prompts.
- Validate installer success/failure paths with isolated fixtures, run Rust checks and build, and validate workflow syntax. Hosted builds and account login remain separate checks.

- **[chosen]** WiFix login/logout matches the Omarchy plugin's certificate exception for the fixed campus portal. Use a dedicated client, no redirects, interface-address binding, direct campus DNS queries, and positive connectivity verification.
- Added `hickory-proto` for DNS parsing and macOS-only `objc2-core-wlan` for native SSID discovery, under the authorization to add related packages.

- Replaced the previous GPL license in `.github/LICENSE` and updated both plugin manifests to keep license metadata consistent.
- Verified six Rust tests, eight isolated shell installer tests, Linux release build and Clippy, macOS arm64 and Windows x64 target checks and Clippy, login page TypeScript/build, shell syntax, and workflow syntax.
- Windows release builds use a static C runtime. Windows installer tests are configured in the native Windows build jobs; they have not run locally.
- A live status check discovered campus Wi-Fi, but the connectivity endpoint failed with both the CLI and equivalent curl requests. Campus login/logout remains unverified; neither action was run on the current connection.

Status: implementation and local verification complete. Commit locally; the first hosted build and release require pushing to main.
