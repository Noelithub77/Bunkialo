# Bunkialo Omarchy plugin

The Omarchy plugin provides a compact desktop panel for Bunkialo's timetable,
mess menu, notifications, and WiFix controls. It keeps the most useful campus
information visible without opening the full app.

![Bunkialo Omarchy plugin panel](../assets/omarchy-plugin-panel.png)

The panel shows the current and upcoming timetable entries, today's meals,
connection status, refresh controls, notifications, and settings. Its
dashboard can be opened with `SUPER+B` after the optional shortcut setup below.

## Install

Install and enable only the plugin with Omarchy's plugin CLI:

```bash
omarchy plugin add https://github.com/Noelithub77/bunkialo2.git --enable --yes
```

The plugin CLI does not modify Hyprland keybindings. To install the plugin,
add the Bunkialo shortcuts, reload Hyprland, and validate the configuration in
one command, run:

```bash
curl -fsSL https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/scripts/setup-omarchy.sh | bash
```

The script is idempotent. It can also be run from a local clone:

```bash
git clone https://github.com/Noelithub77/bunkialo2.git
cd bunkialo2
./scripts/setup-omarchy.sh
```

The plugin uses the production Bunkialo desktop API. Open the Bunkialo
credentials page, copy the one-line two-entry JSON, and save it in the plugin
settings. The plugin keeps it in Secret Service and sends that JSON as the
desktop request credential; it does not depend on a time-limited desktop
pairing record. WiFix uses the first entry locally; connecting to WiFi does not
contact Bunkialo. Refreshing timetable or notifications still uses the
production API.

WiFix only handles the campus SSIDs `IIITKottayam` and `IIITKottayam_5G`. Each check or action refreshes the connected device, actual SSID (without a scan), IPv4 address, and DNS metadata. It prefers DHCP DNS, resolves the portal and probe hosts through those servers, and binds HTTP requests to the Wi-Fi interface. DNS queries use the Wi-Fi source address. Proxy environment variables and user curl configuration are bypassed for these requests.

Connectivity checks try Google, Microsoft, and Mozilla with short timeouts. Only the expected empty HTTP 204 or Microsoft's exact connectivity text confirms internet access. Campus portal redirects or login forms confirm a captive connection. Failed requests remain unknown; they do not become successful logout or proof of a captive portal.

Login fetches the official portal form, extracts its `magic` and `4Tredir` fields, validates the form destination, and sends credentials through curl's stdin. Logout calls only the portal logout URL. Both actions verify connectivity afterward and retry verification once, without repeating the credential POST. Checks and actions are serialized and have a watchdog that stops outstanding processes. Portal certificate handling retains the existing campus-only exception. System DNS, VPN settings, and Wi-Fi connections are not modified.

Run the isolated service regression tests without using personal credentials or the live desktop:

```sh
python3 tests/omarchy/test_wifix.py
```

These tests run the real Quickshell service offscreen with fixture commands for fallback connectivity, unavailable checks, login, and logout.

Run the real local round-trip test while connected to campus WiFi:

```bash
bun run test:wifix:atomic
```

It logs each request's exit code, HTTP status, gateway, response size, and
sanitized curl error, then verifies WiFi connectivity and that Tailscale's
interface state did not change.

## Keybindings

The normal Omarchy plugin installer does not change Hyprland configuration.
If you do not use `scripts/setup-omarchy.sh`, add these to
`~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + B", "Bunkialo", "omarchy-shell shell toggle noel.bunkialo")
hl.unbind("SUPER + SHIFT + B")
o.bind("SUPER + SHIFT + B", "WiFix", "sh -c 'quickshell ipc -p /usr/share/omarchy/shell -n call noel.bunkialo showWifix; omarchy-shell shell toggle noel.bunkialo'")
```
