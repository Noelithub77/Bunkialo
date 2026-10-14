# Cli installation and WiFix

## Confirmed decisions

- **[chosen]** Publish a rolling `cli-latest` release after successful builds on main, separate from Android releases.
- **[chosen]** Use a shared macOS/Linux installer and a Windows PowerShell installer; offer the companion skill, then open browser login.
- **[chosen]** Put installation first in the README and use AGPL-3.0-only in `LICENSE.md` and package/plugin metadata.
- **[chosen]** Match the Omarchy plugin's certificate exception only for the fixed campus authentication portal.
- **[chosen]** Use bounded Google, Microsoft, and Mozilla fallback endpoints for connectivity verification.

## Delivered

- Build and release x64/arm64 binaries for Linux, macOS, and Windows. Installers verify checksums, preserve unrelated shortcut commands, and provide `wifix`, `wifix status`, and `wifix logout`.
- Use native keyring backends, `hickory-proto` DNS parsing, macOS CoreWLAN discovery, and `socket2`/Unix `libc` support for interface-bound DNS. Unix HTTP is interface-bound; Windows has a destination-route guard.
- Refresh changed Wi-Fi attachments before portal actions. Keep failed connectivity checks unknown and serialize plugin requests with bounded verification and a watchdog.
- Activate the default browser on Hyprland after opening login. An invisible OmaBox run loaded the login page and returned browser focus from a foreground terminal.
- Merge PR #36's top-level companion skill and publish the changes to main. GitHub marked the PR merged and removed its branch.
- Update and commit the installed user-owned plugin in dotfiles. Reload the live shell after explicit approval; confirm its IPC target and the new probe logs.

## Verification

- Seven Rust tests, nine installer fixtures, four actual-service offscreen plugin regressions, strict Clippy for Linux/macOS/Windows, and workflow validation passed.
- All six native targets and the release job passed in [the hosted build](https://github.com/Noelithub77/bunkialo2/actions/runs/38543705169). The release contains the code from `ec569f9` and matching checksums.
- The published Linux one-command installer passed in a temporary home directory, including its binary and standalone shortcut checks.
- Live campus probes still time out. Real campus login/logout remains unverified; fixture round trips and unknown-state handling pass.
- The broad dotfiles status check reports seven unrelated link/setup failures; Bunkialo manifest validation passes and unrelated edits were preserved.

Status: implementation, publication, and installed plugin activation complete.
