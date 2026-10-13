# Bunkialo CLI

The Rust `bunkialo` command reads IIIT Kottayam Moodle and attendance records in the terminal. It can download course files, inspect assignment details, and submit or revert Moodle assignments.

## Install from source

From this repository's root, build and install with Rust and Cargo on Linux:

```bash
cargo build --release --locked --manifest-path cli/Cargo.toml
install -Dm755 cli/target/release/bunkialo ~/.local/bin/bunkialo
~/.local/bin/bunkialo --help
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

## Agent-assisted install

The reusable [Bunkialo academic portals skill](skills/bunkialo-academic-portals/SKILL.md) guides an agent through installing and operating this CLI. From a checkout, an agent should:

1. Confirm Rust and Cargo are available, inspect the checkout and user-local `PATH`, then build the locked release binary using the command above.
2. Install the binary to a user-local directory on `PATH`, such as `~/.local/bin/bunkialo`. Install `cli/skills/bunkialo-academic-portals/SKILL.md` to `${CODEX_HOME:-$HOME/.codex}/skills/bunkialo-academic-portals/SKILL.md` (create its directory first). Replace an existing installation only after the new build and skill source are ready; leave differently named skills alone.
3. Check `bunkialo --help` and `bunkialo auth status`. If the user requested account setup, use `bunkialo login` and verify one live LMS read and one official attendance read. `auth status` alone only confirms that credentials exist.

An agent can be asked: “Install the Bunkialo CLI and its academic portals skill from this checkout, connect my accounts if I provide credentials, and verify both portals.” Credentials belong in the OS keyring, never in the repository or skill.
