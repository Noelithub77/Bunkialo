#!/bin/sh
set -eu

release_url=https://github.com/Noelithub77/bunkialo2/releases/download/cli-latest
skill_url=https://github.com/Noelithub77/bunkialo2/tree/main/skills/bunkialo-academic-portals
install_dir=${BUNKIALO_INSTALL_DIR:-"$HOME/.local/bin"}
skip_login=false
skip_skill=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-login) skip_login=true ;;
    --no-skill) skip_skill=true ;;
    --install-dir) shift; install_dir=${1:?--install-dir needs a directory} ;;
    --help) printf '%s\n' 'Usage: install.sh [--install-dir DIR] [--no-skill] [--no-login]'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 1 ;;
  esac
  shift
done
case "$install_dir" in /*) ;; *) printf 'Install directory must be absolute.\n' >&2; exit 1 ;; esac
case "$(uname -s)" in
  Linux) platform=unknown-linux-gnu ;;
  Darwin) platform=apple-darwin ;;
  *) printf 'Use install.ps1 on Windows. Supported systems: macOS and Linux.\n' >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  arm64|aarch64) arch=aarch64 ;;
  *) printf 'Unsupported CPU architecture. Use the source build instructions.\n' >&2; exit 1 ;;
esac
asset="bunkialo-$arch-$platform"
fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$1" -O "$2"
  else
    printf 'Install curl or wget, then run this installer again.\n' >&2
    return 1
  fi
}
checksum() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1"
  else printf 'A SHA-256 tool (sha256sum or shasum) is required.\n' >&2; return 1
  fi
}
task_tmp=$(mktemp -d)
trap 'rm -rf "$task_tmp"' EXIT HUP INT TERM
printf 'Downloading Bunkialo for %s…\n' "$arch-$platform"
if ! fetch "$release_url/$asset" "$task_tmp/bunkialo" || ! fetch "$release_url/$asset.sha256" "$task_tmp/checksum"; then
  printf 'Download failed. Check your connection and that the cli-latest release is available.\n' >&2
  exit 1
fi
expected=$(awk '{print $1}' "$task_tmp/checksum")
actual=$(checksum "$task_tmp/bunkialo" | awk '{print $1}')
if ! printf '%s\n' "$expected" | grep -Eq '^[0-9a-fA-F]{64}$' || [ "$expected" != "$actual" ]; then
  printf 'Checksum verification failed; the existing installation was preserved.\n' >&2
  exit 1
fi
chmod 755 "$task_tmp/bunkialo"
if ! "$task_tmp/bunkialo" --help >/dev/null; then
  printf 'This binary cannot run here. Linux requires glibc 2.35+, libssl3 and libdbus-1; see cli/README.md.\n' >&2
  exit 1
fi
mkdir -p "$install_dir"
# Stage beside the destination so replacement stays on the same filesystem.
staged=$(mktemp "$install_dir/.bunkialo.XXXXXX")
trap 'rm -rf "$task_tmp"; rm -f "$staged"' EXIT HUP INT TERM
cp "$task_tmp/bunkialo" "$staged"
chmod 755 "$staged"
mv -f "$staged" "$install_dir/bunkialo"
printf 'Installed %s/bunkialo\n' "$install_dir"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *)
    # Quote the path for shell startup files, including embedded apostrophes.
    quoted_dir=$(printf '%s' "$install_dir" | sed "s/'/'\\\\''/g")
    path_line="export PATH='$quoted_dir':\"\$PATH\""
    case "${SHELL:-}" in
      */zsh) profile="$HOME/.zshrc" ;;
      */bash) profile="$HOME/.bashrc" ;;
      *) profile="$HOME/.profile" ;;
    esac
    if ! grep -Fqx "$path_line" "$profile" 2>/dev/null; then
      printf '\n# Bunkialo CLI\n%s\n' "$path_line" >> "$profile"
    fi
    printf 'Open a new terminal to use bunkialo by name.\n'
    ;;
esac
PATH="$install_dir:$PATH"
export PATH
# Piped installation scripts still need the terminal for skill selection and login.
interactive=false
if ( : </dev/tty ) 2>/dev/null; then
  exec 3<>/dev/tty
  interactive=true
fi
if [ "$skip_skill" = false ] && [ "$interactive" = true ]; then
  printf 'Install the Bunkialo agent skill? [y/N] ' >&3
  answer=
  read -r answer <&3 || true
  case "$answer" in
    y|Y|yes|YES)
      if command -v npx >/dev/null 2>&1; then
        if ! npx --yes skills add "$skill_url" --global <&3; then
          printf 'Skill installation failed. The CLI is installed; you can retry the skill later.\n' >&2
        fi
      else
        printf 'Skill installation needs Node.js and npx. Install Node.js, then run:\n  npx skills add %s --global\n' "$skill_url"
      fi
      ;;
  esac
fi
if [ "$skip_login" = false ] && [ "$interactive" = true ]; then
  printf 'Starting browser login…\n'
  "$install_dir/bunkialo" login <&3
elif [ "$skip_login" = false ]; then
  printf 'No interactive terminal found. Run bunkialo login when ready.\n'
fi
