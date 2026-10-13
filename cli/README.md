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

## Agent skill via npx

Install the reusable [Bunkialo academic portals skill](../skills/bunkialo-academic-portals/SKILL.md) for Codex with the [Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx --yes skills add Noelithub77/bunkialo2 --skill bunkialo-academic-portals --agent codex --global --yes
```

The command installs the agent skill, not the Rust executable. Ask the agent to install the CLI from source using the locked Cargo build above. It should install the binary in a user-local directory on `PATH`, check `bunkialo --help` and `bunkialo auth status`, and perform live reads from both portals if account setup was requested. Credentials belong in the OS keyring, never in the repository or skill. An existing differently named personal skill can remain installed alongside this one.
