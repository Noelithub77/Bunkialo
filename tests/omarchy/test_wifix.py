"""Drive the real Quickshell service with isolated network commands and credentials."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

PLUGIN = Path(__file__).resolve().parents[2] / 'omarchy-plugin'


class WifixTests(unittest.TestCase):
    def run_scenario(self, scenario, expected):
        with tempfile.TemporaryDirectory() as task_temp:
            root = Path(task_temp)
            for filename in ('WifixService.qml', 'WifixApi.js'):
                shutil.copy(PLUGIN / filename, root / filename)
            tools = root / 'tools'
            tools.mkdir()
            network = r'''#!/usr/bin/env python3
import os, sys
from pathlib import Path
name = Path(sys.argv[0]).name
args = sys.argv[1:]
root = Path(os.environ['WIFIX_FIXTURE'])
scenario = os.environ['WIFIX_SCENARIO']
with (root / 'calls').open('a') as log:
    log.write(name + ' ' + ' '.join(args) + '\n')
if name == 'nmcli':
    if 'ACTIVE,SSID' in args:
        print('yes:IIITKottayam_5G')
    elif any('IP4.ADDRESS' in item for item in args):
        print('10.0.0.2/24\n10.0.0.1\ndomain_name_servers = 10.0.0.1')
    elif 'IP4.DNS' in args:
        print('10.0.0.1')
    else:
        print('wlan0:wifi:connected:IIITKottayam_5G')
elif name == 'dig':
    print('10.0.0.1')
elif name == 'curl':
    config = sys.stdin.read() if '-K' in args else ''
    if config:
        if 'interface = "if!wlan0"' not in config or 'noproxy = "*"' not in config:
            print('fixture rejected unbound portal request', file=sys.stderr)
            sys.exit(9)
        if '/logout?' in config:
            (root / 'logged-out').touch()
            print('HTTP/1.1 200 OK\r\n\r\nLogged out\nbunkialo-status:200')
        elif 'request = "POST"' in config:
            (root / 'logged-in').touch()
            with (root / 'posts').open('a') as count: count.write('post\n')
            print('HTTP/1.1 200 OK\r\n\r\nSubmitted\nbunkialo-status:200')
        else:
            print('HTTP/1.1 200 OK\r\n\r\n<form action="/"><input name="magic" value="abc"></form>\nbunkialo-status:200')
    else:
        if scenario == 'unknown':
            print('000')
            sys.exit(7)
        online = scenario == 'fallback' or (root / 'logged-in').exists() and not (root / 'logged-out').exists()
        if online:
            if 'connectivitycheck.gstatic.com' in ' '.join(args):
                print('000')
                sys.exit(7)
            print('HTTP/1.1 200 OK\r\n\r\nMicrosoft Connect Test\nbunkialo-status:200')
        else:
            print('HTTP/1.1 302 Found\r\nLocation: https://auth.iiitkottayam.ac.in:1442/login\r\n\r\n\nbunkialo-status:302')
'''
            for name in ('nmcli', 'dig', 'curl'):
                command = tools / name
                command.write_text(network)
                command.chmod(0o755)
            # The service starts detection on completion, as in the production shell.
            (root / 'shell.qml').write_text('''import QtQuick
import Quickshell
Item {
  property bool acted: false
  WifixService {
    id: service
    cacheDir: "''' + str(root) + '''"
    pairingCode: '{"student":"fixture-password","attendance":"fixture"}'
    onChanged: {
      if (wifixChecking) return
      if ("''' + scenario + '''" === "login" && !parent.acted && !wifixConnected) {
        parent.acted = true
        Qt.callLater(function() { service.connect(); service.connect() })
        return
      }
      if ("''' + scenario + '''" === "logout" && !parent.acted && wifixConnected) {
        parent.acted = true
        Qt.callLater(function() { service.logout() })
        return
      }
      console.log("fixture-result:" + JSON.stringify({ connected: wifixConnected, message: wifixMessage }))
      Qt.quit()
    }
  }
  Timer { interval: 8000; running: true; onTriggered: { console.log("fixture-timeout"); Qt.quit() } }
}
''')
            if scenario == 'logout':
                (root / 'logged-in').touch()
            env = dict(os.environ, HOME=str(root), XDG_CONFIG_HOME=str(root / 'config'),
                       XDG_CACHE_HOME=str(root / 'cache'), QT_QPA_PLATFORM='offscreen',
                       QT_QPA_PLATFORMTHEME='generic', QT_STYLE_OVERRIDE='Fusion',
                       PATH=str(tools) + ':' + os.environ['PATH'],
                       WIFIX_FIXTURE=str(root), WIFIX_SCENARIO=scenario)
            env.pop('HYPRLAND_INSTANCE_SIGNATURE', None)
            env.pop('WAYLAND_DISPLAY', None)
            env.pop('DISPLAY', None)
            result = subprocess.run(['quickshell', '--no-color', '-p', str(root / 'shell.qml')],
                                    env=env, capture_output=True, text=True, timeout=12)
            logs = result.stdout + result.stderr
            self.assertNotIn('fixture-timeout', logs, logs)
            line = next((line.split('fixture-result:', 1)[1] for line in logs.splitlines() if 'fixture-result:' in line), None)
            self.assertIsNotNone(line, logs)
            self.assertEqual(logs.count('fixture-result:'), 1, logs)
            actual = json.loads(line)
            self.assertEqual(actual['connected'], expected, logs)
            if scenario == 'unknown':
                self.assertIn('unavailable', actual['message'].lower())
                self.assertNotIn('portal detected', actual['message'].lower())
            calls = (root / 'calls').read_text()
            if scenario == 'fallback':
                self.assertIn('msftconnecttest.com', calls)
            if scenario == 'login':
                self.assertTrue((root / 'logged-in').exists(), logs)
                self.assertEqual((root / 'posts').read_text().splitlines(), ['post'], logs)
            if scenario == 'logout':
                self.assertTrue((root / 'logged-out').exists(), logs)
            return logs

    def test_fallback_endpoint_recovers_failed_primary(self):
        self.run_scenario('fallback', True)

    def test_outage_stays_unknown(self):
        self.run_scenario('unknown', False)

    def test_login_uses_interface_and_verifies(self):
        self.run_scenario('login', True)

    def test_logout_uses_interface_and_verifies(self):
        self.run_scenario('logout', False)


if __name__ == '__main__':
    unittest.main()
