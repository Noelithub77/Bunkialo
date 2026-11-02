"""Verify the real panel's error disclosure in an invisible OmaBox."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import unittest

REPO = Path(__file__).resolve().parents[2]


class PanelTests(unittest.TestCase):
    def test_errors_are_hidden_until_requested(self):
        box = 'bunkialo-errors-' + str(os.getpid())

        def run(*args):
            return subprocess.run(['omabox', *args], check=True, text=True,
                                  capture_output=True, timeout=45).stdout.strip()

        run('up', box, '--no-shell', '--net', 'isolated', '--size', '1280x800@60')
        root = Path(run('path', '-b', box)) / 'home' / 'bunkialo-panel-test'
        try:
            root.mkdir()
            shutil.copytree(REPO / 'omarchy-plugin', root / 'plugin')
            for directory in ('Commons', 'Ui'):
                shutil.copytree(Path('/usr/share/omarchy/shell') / directory, root / directory)
            shutil.copy(REPO / 'tests/omarchy/panel.qml', root / 'shell.qml')
            run('run', '-b', box, '-d', '--', 'sh', '-c',
                'exec quickshell -p "$HOME/bunkialo-panel-test" > "$HOME/bunkialo-panel-test/check.log" 2>&1')

            def ipc(*args):
                return run('run', '-b', box, '--', 'sh', '-c',
                           'quickshell -p "$HOME/bunkialo-panel-test" ipc call bunkialo-panel-test "$@"',
                           'sh', *args)

            def status():
                return json.loads(ipc('status'))

            deadline = time.monotonic() + 8
            while True:
                try:
                    ipc('open')
                    break
                except subprocess.CalledProcessError:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(0.1)
            time.sleep(0.4)
            self.assertTrue(status()['button'])
            self.assertFalse(status()['details'])
            artifacts = REPO / 'artifacts/omarchy'
            artifacts.mkdir(parents=True, exist_ok=True)
            run('shot', '-b', box, '-o', str(artifacts / 'errors-collapsed.png'))
            x, y = ipc('point').split()
            run('click', '-b', box, x, y)
            self.assertTrue(status()['details'])
            self.assertEqual(status()['text'], 'Wi-Fi check unavailable · retry')
            run('keys', '-b', box, 'Escape')
            self.assertFalse(status()['details'])
            self.assertTrue(status()['opened'])
            run('click', '-b', box, x, y)
            run('click', '-b', box, x, y)
            self.assertFalse(status()['details'])
            run('click', '-b', box, x, y)
            message = 'A different error with complete details. ' * 8
            ipc('error', message)
            self.assertFalse(status()['details'])
            x, y = ipc('point').split()
            run('click', '-b', box, x, y)
            self.assertEqual(status()['text'], message)
            run('shot', '-b', box, '-o', str(artifacts / 'errors-expanded.png'))
            ipc('close')
            ipc('open')
            self.assertFalse(status()['details'])
            ipc('error', '')
            self.assertFalse(status()['button'])
            logs = (root / 'check.log').read_text()
            for error in ('TypeError', 'ReferenceError', 'Unable to assign', 'Cannot read'):
                self.assertNotIn(error, logs)
        except Exception:
            log = root / 'check.log'
            if log.exists():
                print(log.read_text())
            raise
        finally:
            run('down', box)


if __name__ == '__main__':
    unittest.main()
