# WiFix connectivity through a VPN

- Cause verified: WARP's firewall drops the plugin's interface-bound public
  probes. All three return curl exit 28; the same endpoint through WARP returns
  HTTP 204. DHCP DNS and the direct campus portal remain reachable.
- **[chosen]** Add a VPN-aware plugin fallback, preserving direct campus portal
  requests and the user's network configuration.
- User follow-up: replace the panel's always-visible error text with a compact
  error button. Reveal the complete message on demand; close it with the button
  or Escape and reset disclosure when the message changes or the panel closes.
- Keep direct captive detection authoritative. Only probe a tunnel confirmed
  by both the current route and connected NetworkManager device metadata.
- Require the expected HTTPS response through that tunnel. Label VPN access
  separately and never treat it as verified campus login/logout or cache it as
  direct campus access.
- Verify the real service using isolated fixtures and a read-only local network
  check, then synchronize the two changed runtime files to the tracked installed
  plugin and activate once. Preserve unrelated dotfiles changes.

Status: implemented. Eleven isolated network service regressions, 126 app unit
tests, TypeScript checking, and installed-plugin staging validation passed.
The real service confirmed `Internet connected · VPN` with WARP enabled on
campus Wi-Fi, without logging in or out. Error disclosure passed isolated
interaction and rendered checks, including wrapping a long message. Applied
the three tested files to the installed plugin and restarted the shell once;
its live journal confirms `via=vpn state=online curl=0` after activation.

Repository lint is blocked by existing em-dash copy violations in eight
unchanged files. The generic dotfiles status check reports existing unrelated
configuration/link issues; the installed plugin remains enabled and validates.
