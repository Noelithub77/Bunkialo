# Bunkialo CLI

The Rust `bunkialo` command reads IIIT Kottayam Moodle and attendance records in the terminal. It can download course files, inspect assignment details, and submit or revert Moodle assignments.

## Install

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.ps1 | iex
```

The installer downloads the matching binary from the rolling [`cli-latest` release](https://github.com/Noelithub77/bunkialo2/releases/tag/cli-latest), verifies its SHA-256 checksum, and installs it in a user directory. It offers the [academic portals skill](../skills/bunkialo-academic-portals/SKILL.md), then runs `bunkialo login`. The skill uses the [Skills CLI](https://github.com/vercel-labs/skills) to choose your agent and requires Node.js with `npx`; declining or failing skill installation still proceeds to login.

Supported binaries are x64 and arm64 on each platform:

- Linux: glibc 2.35 or newer, OpenSSL 3, and D-Bus libraries. Persistent credentials require a running, unlocked Secret Service keyring, such as GNOME Keyring or KWallet. Alpine/musl Linux needs a source build.
- macOS: macOS 14 or newer for Apple Silicon; macOS 15 or newer for Intel. Credentials use macOS Keychain. Release binaries are not notarized.
- Windows: Windows 10/11 x64 or Windows 11 arm64. Release builds link the C runtime statically. Credentials use Windows Credential Manager.

macOS/Linux use `~/.local/bin` and add it to the current shell's startup file if needed; open a new terminal afterward. Windows uses `%LOCALAPPDATA%\Bunkialo\bin` and adds it to your user `PATH`. Both installers add a `wifix` shortcut for login, status, and logout; an existing unrelated command with that name is preserved. Installers use the full binary path for login immediately. Linux needs `curl` or `wget` and `sha256sum` or `shasum`; macOS and Windows already include their download and checksum tools. No installer can supply `npx` without Node.js, so missing Node.js skips the optional skill and prints the retry command.

For an unattended install or a custom directory:

```sh
curl -fsSL https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.sh | sh -s -- --no-skill --no-login --install-dir "$HOME/.local/bin"
```

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.ps1))) -SkipSkill -SkipLogin -InstallDir "$env:LOCALAPPDATA\Bunkialo\bin"
```

Without an interactive terminal, installers skip skill prompts and browser login. Run `bunkialo login` later. Rerunning the installer updates the binary without clearing saved credentials. A failed download, checksum, or binary smoke check preserves the installed version.

## Install from source

Install Rust/Cargo first. On Debian/Ubuntu, source builds also need `pkg-config`, `libssl-dev`, and `libdbus-1-dev`; Fedora equivalents are `pkgconf-pkg-config`, `openssl-devel`, and `dbus-devel`, and Arch equivalents are `pkgconf`, `openssl`, and `dbus`. macOS needs Xcode Command Line Tools; Windows needs the Visual Studio C++ build tools and Windows SDK.

```sh
cargo install --locked --path cli
bunkialo --help
bunkialo login
```

On Hyprland, `bunkialo login` also activates the most recently focused window matching the default browser's desktop entry after opening the page. Other desktops and platforms use their standard browser-opening behavior.

The Vite-built login page is included in the Rust binary. If you edit the page, rebuild its assets first with Bun:

```bash
cd cli/login-ui
bun install --frozen-lockfile
bun run build
cd ../..
cargo build --release --locked --manifest-path cli/Cargo.toml
```

Run `bunkialo login` to open the local browser sign-in page. Connect LMS first, then the [official attendance portal](https://attendance.iiitkottayam.ac.in/). The page binds to `127.0.0.1` for up to ten minutes; Rust validates both accounts before saving them in the OS keyring. Neither passwords nor session tokens are put in repository files. `bunkialo auth status` reports whether each account is configured. Existing `acads` keyring entries remain readable for migration.

## Commands

```text
bunkialo login
bunkialo auth status|store
bunkialo wifix [login|status|logout]
bunkialo lms courses|recent|deadlines|course|content|assignments|resources|page|assignment|quiz|forum|discussion
bunkialo lms download URL [--output PATH] [--force]
bunkialo lms download-assignment ACTIVITY_ID [--output-dir DIR] [--force]
bunkialo lms download-course COURSE_ID [--output-dir DIR] [--force]
bunkialo lms submit ACTIVITY_ID --file PATH [--file PATH ...]
bunkialo lms unsubmit ACTIVITY_ID [--dry-run]
bunkialo attendance profile|terms|summary|sessions|report|appeal|apply-leave|apply-medical-leave
bunkialo attendance dl [COURSE_ID] [--json]
```

`lms recent` prints assignments and quizzes whose due or close time is within 30 days before or after now, including submission or attempt state. Attendance reports use `attendance.iiitkottayam.ac.in`, not Moodle's attendance module. Run `bunkialo lms COMMAND --help` or `bunkialo attendance COMMAND --help` for details.

`attendance dl` reads live course attendance and calculates how many existing absent classes need additional duty leave credit to reach at least 80%. The total class count stays fixed: `max(0, ceil(total × 4 / 5) − present − dlCredited)`. For example, 33/47 needs 5 additional credits to become 38/47 (80.85%). Existing credited duty leave counts toward attendance; uncredited overflow does not. Exactly 80% meets the threshold, and the report also identifies when one more credit is needed to go strictly above 80%.

Run `bunkialo attendance dl CSS311` to filter by course code or attendance course ID. `--json` returns the source, fetch time, fixed threshold, assumptions, and per-course counts and projections. Empty or invalid course data and unknown course filters fail with a nonzero exit status; a course with no classes is reported as `no_classes`. The calculator does not submit applications, change attendance, or establish eligibility, approval, or available duty leave allowances.

### College policies and attendance planning

`bunkialo --help` and `bunkialo attendance --help` include the attendance planning guidance without requiring credentials or a network connection. The target of strictly above 80% with a buffer is the user's planning convention; this guidance is not an independently verified college policy. Confirm institutional thresholds, leave eligibility, limits and approvals with the college.

When approved duty leave removes an absent session, calculate `attended / (total sessions - approved removals) * 100`. Keep the attended count unchanged and count recorded sessions rather than hours. For example, 28/39 with six removals becomes 28/33 (84.85%); if one removal is rejected, 28/34 remains 82.35%.

Refresh live attendance after faculty updates. Exclude sessions already marked present or already removed, deduplicate overlapping internship and event claims, and match only the relevant student's actual duty dates and absent sessions. Nearby event dates do not establish eligibility. Internship cutoffs depend on the individual's approval. Pending leave is a conditional projection, and buffers must be checked separately for each course and recalculated after new sessions or absences.

The current `attendance dl` calculator uses the fixed-total conversion model described above, so its projections do not implement this removal model. Its help explicitly flags that limitation. Use `attendance summary` and `attendance report` for live records when calculating removal projections.

Moodle submissions require confirmation for draft upload, save, and final grading submission. `lms unsubmit` uses Moodle's revert-to-draft action when offered. Existing downloads are preserved unless `--force` is supplied.

`BUNKIALO_LMS_URL` may select an official `https://lmsugYY.iiitkottayam.ac.in` cohort host. The CLI also accepts `BUNKIALO_LMS_USERNAME`, `BUNKIALO_LMS_PASSWORD`, `BUNKIALO_ATTENDANCE_EMAIL`, and `BUNKIALO_ATTENDANCE_PASSWORD` for the current process; avoid passwords in shell history. The `ACADS_` names remain as compatibility fallbacks.

## Campus Wi-Fi

```sh
bunkialo wifix          # Log in; already-online connections are left alone
bunkialo wifix status   # Check connectivity without logging in or out
bunkialo wifix logout   # Log out of the campus portal; keep Wi-Fi connected
wifix                 # Same as bunkialo wifix
wifix status
wifix logout
```

Connect to `IIITKottayam` or `IIITKottayam_5G` first. WiFix discovers the active Wi-Fi interface, its IPv4 address, and its DNS servers. It prefers DHCP DNS on Linux and macOS; Windows uses the active adapter's configured DNS. It queries those servers directly, pins the campus portal's hostname to the returned address, binds requests to the Wi-Fi IPv4 address, and bypasses proxy environment settings. Linux and macOS also bind DNS and HTTP sockets to the Wi-Fi interface, preventing a VPN route from taking over. Windows verifies that the destination route selects the Wi-Fi adapter and stops with a split-tunneling message if it does not. It does not change system DNS or disconnect Wi-Fi.

Login reuses the saved LMS username/password from `bunkialo login`, or the existing LMS environment variables. If none are available, it prompts without saving them. Logout needs no credentials. Like the Omarchy plugin, certificate validation is bypassed only in the client for `https://auth.iiitkottayam.ac.in:1442`; redirects are disabled and credentials are posted only to that fixed origin. Other CLI clients keep their existing TLS verification.

Connectivity checks try Google, Microsoft, and Mozilla endpoints within a 15-second network budget, with short per-request timeouts and at most three DNS servers. Google/Mozilla must return an empty HTTP 204; Microsoft must return its exact expected text. Checks report underlying connection failures and refresh a changed Wi-Fi attachment once before sending a portal action. Login succeeds only after one of those endpoints confirms internet access. Logout succeeds only after the endpoint returns the campus captive login page or redirects to the campus portal. Timeouts and unrelated errors are reported as unverified, not successful logout. WiFix performs one requested action; it does not install a background reconnect service or continuously keep the session alive.

Platform discovery uses these existing system tools:

- Linux: NetworkManager with `nmcli`. If missing, install your distribution's `network-manager`/`NetworkManager` package and use NetworkManager to manage campus Wi-Fi.
- macOS: the native CoreWLAN framework (via `objc2-core-wlan`) and the built-in `ipconfig` tool. Location Services permission for your terminal may be needed to reveal the connected SSID.
- Windows: PowerShell, `netsh`, and the built-in network/CIM cmdlets. Windows location permission may be needed to reveal the connected SSID.

If the OS cannot reveal the campus SSID or more than one campus Wi-Fi interface is active, WiFix stops before sending credentials. Disconnect additional campus interfaces and check network/location permissions, then retry.

## Builds and verification

[Build and release CLI](../.github/workflows/cli-release.yml) watches `main` pushes affecting Rust sources, Cargo manifests/lockfile, login UI, installers, installer tests, companion skills, or the workflow. Documentation-only changes do not build. It rebuilds the login page, runs Rust tests, strict Clippy checks and installer tests, builds six native targets, and uploads binaries plus checksums only after every target succeeds. The rolling release stays separate from Android releases and is not marked as GitHub's latest app release. Its notes identify the source commit; the rolling tag itself retains its initial commit.

```sh
cargo test --locked --manifest-path cli/Cargo.toml
cargo clippy --locked --manifest-path cli/Cargo.toml --all-targets -- -D warnings
python3 cli/tests/test_install.py
```

Windows installer tests run in the Windows build jobs against a locally built binary. Shell tests use isolated download/binary fixtures and a pseudo terminal to check skill consent and automatic login; they do not install skills or connect accounts.

## Agent skill via npx

The [Bunkialo academic portals skill](../skills/bunkialo-academic-portals/SKILL.md) guides an agent through installing and operating this CLI. Use the installer above, or build from a checkout when a release does not cover the system. Install the skill globally with:

```sh
npx skills add Noelithub77/bunkialo2 --skill bunkialo-academic-portals --global
```

Check `bunkialo --help` and `bunkialo auth status`. If account setup was requested, use `bunkialo login` and verify one live LMS read and one official attendance read. `auth status` alone only confirms that credentials exist. Credentials belong in the OS keyring, never in the repository or skill.

Licensed under [AGPL-3.0](../LICENSE.md).
