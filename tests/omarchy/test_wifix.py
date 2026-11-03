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
            for filename in ('WifixService.qml', 'WifixNotifier.qml', 'WifixApi.js'):
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
# The portal host only resolves through campus DNS (10.0.0.1); Home is a
# network without the portal.
devices = {
    'ethernet': ['wlan0:wifi:connected:Home', 'eth0:ethernet:connected:Wired connection 1'],
    'fallthrough': ['eth0:ethernet:connected:Home wired', 'wlan0:wifi:connected:Hostel AP'],
    'no-portal': ['wlan0:wifi:connected:Home', 'eth1:ethernet:unavailable:'],
}.get(scenario, ['wlan0:wifi:connected:IIITKottayam_5G'])
campus = 'eth0' if scenario == 'ethernet' else 'wlan0'
if name == 'nmcli':
    if any('IP4.ADDRESS' in item for item in args):
        if args[-1] == campus and scenario != 'no-portal':
            print('10.0.0.2/24\n10.0.0.1\ndomain_name_servers = 10.0.0.1')
        else:
            print('192.168.1.5/24\n192.168.1.1')
    else:
        print('\n'.join(devices))
        if scenario.startswith('vpn'):
            print('CloudflareWARP:tun:connected (externally):CloudflareWARP')
elif name == 'ip':
    device = 'eth0' if scenario == 'vpn-other-route' else 'CloudflareWARP'
    print('1.1.1.1 dev ' + device + ' src 172.16.0.2')
elif name == 'dig':
    if '@10.0.0.1' in args:
        print('10.0.0.1')
    elif 'auth.iiitkottayam.ac.in' not in args:
        print('203.0.113.7')
elif name == 'curl':
    config = sys.stdin.read() if '-K' in args else ''
    if config:
        if 'interface = "if!' + campus + '"' not in config or 'noproxy = "*"' not in config:
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
        if scenario.startswith('vpn'):
            tunnel = '--interface' in args and args[args.index('--interface') + 1] == 'if!CloudflareWARP'
            if scenario == 'vpn-captive' and not tunnel:
                print('HTTP/1.1 302 Found\r\nLocation: https://auth.iiitkottayam.ac.in:1442/login\r\n\r\n\nbunkialo-status:302')
                sys.exit(0)
            if not tunnel or scenario == 'vpn-outage':
                print('curl: (28) Connection timed out', file=sys.stderr)
                sys.exit(28)
            if '--resolve' in args or '--noproxy' not in args or not args[-1].startswith('https://'):
                print('fixture rejected invalid VPN probe', file=sys.stderr)
                sys.exit(9)
            if scenario == 'vpn-unexpected':
                print('HTTP/1.1 200 OK\r\n\r\nUnexpected page\nbunkialo-status:200')
            else:
                print('HTTP/1.1 204 No Content\r\n\r\n\nbunkialo-status:204')
            sys.exit(0)
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
            for name in ('nmcli', 'dig', 'curl', 'ip', 'gdbus'):
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
      if (("''' + scenario + '''" === "login" || "''' + scenario + '''" === "vpn-login") && !parent.acted) {
        parent.acted = true
        Qt.callLater(function() { service.connect(); service.connect() })
        return
      }
      if (("''' + scenario + '''" === "logout" || "''' + scenario + '''" === "vpn-logout") && !parent.acted && wifixConnected) {
        parent.acted = true
        Qt.callLater(function() { service.logout() })
        return
      }
      console.log("fixture-result:" + JSON.stringify({ connected: wifixConnected, message: wifixMessage,
        available: wifixAvailable, interface: portalInterface, kind: portalKind, network: portalNetwork }))
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
            if scenario in ('vpn', 'vpn-login', 'vpn-logout'):
                self.assertIn('VPN', actual['message'], logs)
                self.assertIn('if!CloudflareWARP', calls)
            if scenario in ('vpn-captive', 'vpn-other-route'):
                self.assertNotIn('if!CloudflareWARP', calls)
            if scenario in ('vpn-login', 'vpn-logout'):
                action = scenario.removeprefix('vpn-')
                self.assertIn(action + ' unverified', actual['message'], logs)
                if action == 'login':
                    self.assertEqual((root / 'posts').read_text().splitlines(), ['post'], logs)
                else:
                    self.assertTrue((root / 'logged-out').exists(), logs)
            return actual, calls

    def test_fallback_endpoint_recovers_failed_primary(self):
        self.run_scenario('fallback', True)

    def test_outage_stays_unknown(self):
        self.run_scenario('unknown', False)

    def test_login_uses_interface_and_verifies(self):
        self.run_scenario('login', True)

    def test_logout_uses_interface_and_verifies(self):
        self.run_scenario('logout', False)

    def test_vpn_recovers_blocked_direct_probes(self):
        self.run_scenario('vpn', True)

    def test_captive_portal_takes_priority_over_vpn(self):
        self.run_scenario('vpn-captive', False)

    def test_vpn_outage_stays_unknown(self):
        self.run_scenario('vpn-outage', False)

    def test_unexpected_vpn_response_stays_unknown(self):
        self.run_scenario('vpn-unexpected', False)

    def test_unrelated_tunnel_does_not_enable_fallback(self):
        self.run_scenario('vpn-other-route', False)

    def test_vpn_access_does_not_verify_campus_login(self):
        self.run_scenario('vpn-login', True)

    def test_vpn_access_does_not_verify_campus_logout(self):
        self.run_scenario('vpn-logout', True)

    def test_ethernet_behind_portal_is_preferred(self):
        actual, calls = self.run_scenario('ethernet', False)
        self.assertEqual((actual['available'], actual['interface'], actual['kind']), (True, 'eth0', 'ethernet'))
        self.assertEqual(actual['message'], 'Campus portal login required')
        self.assertIn('if!eth0', calls)
        self.assertNotIn('if!wlan0', calls)

    def test_portal_found_by_dns_not_ssid_name(self):
        actual, _ = self.run_scenario('fallthrough', False)
        self.assertEqual((actual['available'], actual['interface'], actual['network']), (True, 'wlan0', 'Hostel AP'))

    def test_network_without_portal_is_unavailable(self):
        actual, calls = self.run_scenario('no-portal', False)
        self.assertEqual((actual['available'], actual['interface']), (False, ''))
        self.assertEqual(actual['message'], 'No campus portal on this network')
        self.assertNotIn('curl', calls)


if __name__ == '__main__':
    unittest.main()
