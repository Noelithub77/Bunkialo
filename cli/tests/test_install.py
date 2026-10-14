"""Isolated installer tests; never download releases, install skills, or log in."""
import hashlib
import os
from pathlib import Path
import pty
import select
import subprocess
import tempfile
import time
import unittest

INSTALLER = Path(__file__).resolve().parents[1] / "install.sh"


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.tools = self.root / "tools"
        self.tools.mkdir()
        self.payload = self.root / "payload"
        self.payload.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_CALLS"\n')
        self.env = dict(os.environ, HOME=str(self.home), SHELL="/bin/zsh",
                        PATH=f"{self.tools}:{os.environ['PATH']}",
                        TEST_OS="Linux", TEST_ARCH="x86_64",
                        TEST_PAYLOAD=str(self.payload), TEST_CALLS=str(self.root / "calls"),
                        TEST_URLS=str(self.root / "urls"),
                        TEST_HASH=hashlib.sha256(self.payload.read_bytes()).hexdigest())
        self.write_tool("uname", 'case "$1" in -s) echo "$TEST_OS";; -m) echo "$TEST_ARCH";; esac')
        self.write_tool("curl", '''
while [ "$#" -gt 0 ]; do
  case "$1" in https://*) url=$1;; -o) shift; destination=$1;; esac
  shift
done
printf '%s\n' "$url" >> "$TEST_URLS"
[ "${TEST_DOWNLOAD_FAIL:-}" != yes ] || exit 22
case "$url" in *.sha256) printf '%s  fixture\n' "$TEST_HASH" > "$destination";; *) cp "$TEST_PAYLOAD" "$destination";; esac
''')
        self.write_tool("npx", 'printf "skill %s\\n" "$*" >> "$TEST_CALLS"; exit "${TEST_SKILL_EXIT:-0}"')

    def write_tool(self, name, body):
        path = self.tools / name
        path.write_text("#!/bin/sh\nset -eu\n" + body + "\n")
        path.chmod(0o755)

    def run_installer(self, *args):
        return subprocess.run(["sh", str(INSTALLER), "--no-login", "--no-skill", *args],
                              env=self.env, capture_output=True, text=True)

    def test_platform_assets_and_repeat_install(self):
        for system, arch, target in [
            ("Linux", "x86_64", "x86_64-unknown-linux-gnu"),
            ("Linux", "aarch64", "aarch64-unknown-linux-gnu"),
            ("Darwin", "x86_64", "x86_64-apple-darwin"),
            ("Darwin", "arm64", "aarch64-apple-darwin"),
        ]:
            with self.subTest(target=target):
                self.env.update(TEST_OS=system, TEST_ARCH=arch)
                result = self.run_installer()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"bunkialo-{target}.sha256", (self.root / "urls").read_text())
                self.assertEqual((self.home / ".local/bin/bunkialo").read_bytes(), self.payload.read_bytes())
        self.assertEqual((self.home / ".zshrc").read_text().count("# Bunkialo CLI"), 1)
        self.assertEqual((self.root / "calls").read_text().splitlines(), ["--help"] * 4)

    def test_bad_checksum_preserves_existing_binary(self):
        self.assertEqual(self.run_installer().returncode, 0)
        binary = self.home / ".local/bin/bunkialo"
        binary.write_text("existing installation")
        self.env["TEST_HASH"] = "0" * 64
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Checksum verification failed", result.stderr)
        self.assertEqual(binary.read_text(), "existing installation")

    def test_download_failure_does_not_install(self):
        self.env["TEST_DOWNLOAD_FAIL"] = "yes"
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.home / ".local/bin/bunkialo").exists())

    def test_rejects_unknown_architecture_and_options(self):
        self.env["TEST_ARCH"] = "riscv64"
        self.assertNotEqual(self.run_installer().returncode, 0)
        self.env["TEST_ARCH"] = "x86_64"
        self.assertNotEqual(self.run_installer("--unknown").returncode, 0)
        self.assertNotEqual(self.run_installer("--install-dir", "relative").returncode, 0)

    def test_path_with_spaces_and_apostrophe(self):
        destination = self.home / "it's a bin"
        result = self.run_installer("--install-dir", str(destination))
        self.assertEqual(result.returncode, 0, result.stderr)
        loaded = subprocess.run(["sh", "-c", '. "$HOME/.zshrc"; command -v bunkialo'], env=self.env, capture_output=True, text=True)
        self.assertEqual(loaded.stdout.strip(), str(destination / "bunkialo"))

    def interactive_install(self, answer, skill_exit="0"):
        self.env["TEST_SKILL_EXIT"] = skill_exit
        pid, terminal = pty.fork()
        if pid == 0:
            # Reproduce curl | sh: script bytes occupy stdin, prompts must use /dev/tty.
            read_fd, write_fd = os.pipe()
            os.write(write_fd, INSTALLER.read_bytes())
            os.close(write_fd)
            os.dup2(read_fd, 0)
            os.close(read_fd)
            os.execve("/bin/sh", ["sh"], self.env)
        output = bytearray()
        deadline = time.monotonic() + 15
        answered = False
        status = None
        try:
            while time.monotonic() < deadline:
                if select.select([terminal], [], [], 0.1)[0]:
                    try:
                        chunk = os.read(terminal, 4096)
                    except OSError:
                        break
                    if not chunk:
                        break
                    output.extend(chunk)
                    if not answered and b"Install the Bunkialo agent skill?" in output:
                        os.write(terminal, answer.encode() + b"\n")
                        answered = True
                finished, status = os.waitpid(pid, os.WNOHANG)
                if finished:
                    pid = None
                    break
            if pid is not None:
                finished, status = os.waitpid(pid, os.WNOHANG)
                if not finished:
                    os.kill(pid, 9)
                    os.waitpid(pid, 0)
                    self.fail(f"Installer hung: {output.decode()}")
                pid = None
        finally:
            os.close(terminal)
            if pid is not None:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
        self.assertEqual(os.waitstatus_to_exitcode(status), 0, output.decode())
        return (self.root / "calls").read_text().splitlines()

    def test_skill_consent_then_login_when_piped(self):
        calls = self.interactive_install("y")
        self.assertEqual(calls[0], "--help")
        self.assertIn("skills add https://github.com/Noelithub77/bunkialo2/tree/main/skills/bunkialo-academic-portals --global", calls[1])
        self.assertEqual(calls[2], "login")

    def test_declining_skill_still_starts_login(self):
        self.assertEqual(self.interactive_install("n"), ["--help", "login"])

    def test_failed_skill_still_starts_login(self):
        self.assertEqual(self.interactive_install("y", "1")[-1], "login")


if __name__ == "__main__":
    unittest.main()
