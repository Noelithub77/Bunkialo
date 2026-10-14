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

macOS/Linux use `~/.local/bin` and add it to the current shell's startup file if needed; open a new terminal afterward. Windows uses `%LOCALAPPDATA%\Bunkialo\bin` and adds it to your user `PATH`. Installers use the full binary path for login immediately. Linux needs `curl` or `wget` and `sha256sum` or `shasum`; macOS and Windows already include their download and checksum tools. No installer can supply `npx` without Node.js, so missing Node.js skips the optional skill and prints the retry command.

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
```

`lms recent` prints assignments and quizzes whose due or close time is within 30 days before or after now, including submission or attempt state. Attendance reports use `attendance.iiitkottayam.ac.in`, not Moodle's attendance module. Run `bunkialo lms COMMAND --help` or `bunkialo attendance COMMAND --help` for details.

Moodle submissions require confirmation for draft upload, save, and final grading submission. `lms unsubmit` uses Moodle's revert-to-draft action when offered. Existing downloads are preserved unless `--force` is supplied.

`BUNKIALO_LMS_URL` may select an official `https://lmsugYY.iiitkottayam.ac.in` cohort host. The CLI also accepts `BUNKIALO_LMS_USERNAME`, `BUNKIALO_LMS_PASSWORD`, `BUNKIALO_ATTENDANCE_EMAIL`, and `BUNKIALO_ATTENDANCE_PASSWORD` for the current process; avoid passwords in shell history. The `ACADS_` names remain as compatibility fallbacks.

## Campus Wi-Fi

```sh
bunkialo wifix          # Log in; already-online connections are left alone
bunkialo wifix status   # Check connectivity without logging in or out
bunkialo wifix logout   # Log out of the campus portal; keep Wi-Fi connected
```

Connect to `IIITKottayam` or `IIITKottayam_5G` first. WiFix discovers the active Wi-Fi interface, its IPv4 address, and its DNS servers. It prefers DHCP DNS on Linux and macOS; Windows uses the active adapter's configured DNS. It queries those servers directly, pins the campus portal's hostname to the returned address, binds requests to the Wi-Fi IPv4 address, and bypasses proxy environment settings. It does not change system DNS or disconnect Wi-Fi.

Login reuses the saved LMS username/password from `bunkialo login`, or the existing LMS environment variables. If none are available, it prompts without saving them. Logout needs no credentials. Like the Omarchy plugin, certificate validation is bypassed only in the client for `https://auth.iiitkottayam.ac.in:1442`; redirects are disabled and credentials are posted only to that fixed origin. Other CLI clients keep their existing TLS verification.

Login succeeds only after the connectivity endpoint returns an empty HTTP 204. Logout succeeds only after the endpoint returns the campus captive login page or redirects to the campus portal. Timeouts and unrelated errors are reported as unverified, not successful logout. WiFix performs one requested action; it does not install a background reconnect service or continuously keep the session alive.

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
