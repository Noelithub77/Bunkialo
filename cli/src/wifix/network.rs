use crate::common::CliResult;
use std::net::Ipv4Addr;
use std::process::Command;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Link {
    Ethernet,
    Wifi,
}

impl Link {
    pub fn label(self) -> &'static str {
        match self {
            Link::Ethernet => "Ethernet",
            Link::Wifi => "Wi-Fi",
        }
    }
}

#[derive(Debug)]
pub(super) struct Network {
    pub interface: String,
    /// The SSID or connection name, for display and change detection.
    pub name: String,
    pub link: Link,
    pub address: Ipv4Addr,
    pub dns: Vec<Ipv4Addr>,
}

impl Network {
    pub fn ensure_route(&self, destination: Ipv4Addr) -> CliResult<()> {
        #[cfg(target_os = "windows")]
        {
            let script = format!("$ErrorActionPreference='Stop'; $link=Get-NetIPAddress -IPAddress '{}' -AddressFamily IPv4; $route=Find-NetRoute -RemoteIPAddress '{}' | Where-Object {{ $_.CimClass.CimClassName -eq 'MSFT_NetRoute' }}; if (-not $route -or $route.InterfaceIndex -ne $link.InterfaceIndex) {{ throw 'Destination routes through another interface. Configure VPN split tunneling for the campus network.' }}", self.address, destination);
            output("powershell.exe", &["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", &script])
                .map_err(|_| "The Windows route does not select the campus network. Configure VPN split tunneling and retry; routes were not changed.".to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        let _ = destination;
        Ok(())
    }

    fn usable(&self) -> bool {
        !self.address.is_unspecified() && !self.address.is_loopback() && !self.dns.is_empty()
    }
}

/// Connected Ethernet and Wi-Fi links with an IPv4 address and DNS servers,
/// Ethernet first. Any of them may sit behind the campus portal; the caller
/// finds out by resolving the portal host through each link's own DNS.
pub(super) fn discover() -> CliResult<Vec<Network>> {
    Ok(candidates(links()?))
}

fn candidates(networks: Vec<Network>) -> Vec<Network> {
    let mut networks: Vec<_> = networks.into_iter().filter(Network::usable).collect();
    networks.sort_by_key(|network| network.link == Link::Wifi);
    networks
}

fn output(program: &str, args: &[&str]) -> CliResult<String> {
    let result = Command::new(program)
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .map_err(|_| format!("Could not run {program}; install it or check that it is on PATH."))?;
    if !result.status.success() {
        return Err(format!(
            "{program} could not inspect the network. Check its service and network permissions."
        ));
    }
    Ok(String::from_utf8_lossy(&result.stdout).trim().to_string())
}

/// Like `output`, for per-link details a link may simply not have.
#[cfg(not(target_os = "windows"))]
fn optional_output(program: &str, args: &[&str]) -> Option<String> {
    output(program, args).ok().filter(|value| !value.is_empty())
}

fn ipv4(value: &str) -> CliResult<Ipv4Addr> {
    value
        .trim()
        .split('/')
        .next()
        .unwrap_or("")
        .parse()
        .map_err(|_| "The network has no usable IPv4 address.".into())
}

pub(super) fn dns_addresses(raw: &str) -> Vec<Ipv4Addr> {
    let mut result = Vec::new();
    for item in raw.split(|c: char| c.is_whitespace() || matches!(c, ',' | '|' | '{' | '}')) {
        if let Ok(ip) = item.parse::<Ipv4Addr>() {
            if !ip.is_unspecified() && !ip.is_loopback() && !result.contains(&ip) {
                result.push(ip);
            }
        }
    }
    result
}

/// Splits an `nmcli -t` row; values escape ":" and "\" with a backslash.
#[cfg(any(target_os = "linux", test))]
fn terse_fields(row: &str) -> Vec<String> {
    let mut fields = vec![String::new()];
    let mut chars = row.chars();
    while let Some(ch) = chars.next() {
        match ch {
            '\\' => {
                if let (Some(next), Some(field)) = (chars.next(), fields.last_mut()) {
                    field.push(next);
                }
            }
            ':' => fields.push(String::new()),
            _ => {
                if let Some(field) = fields.last_mut() {
                    field.push(ch);
                }
            }
        }
    }
    fields
}

/// Connected Wi-Fi and Ethernet devices from `nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device`.
#[cfg(any(target_os = "linux", test))]
fn nmcli_links(raw: &str) -> Vec<(String, Link, String)> {
    raw.lines()
        .filter_map(|row| {
            let fields = terse_fields(row);
            if fields.len() < 4 || fields[2] != "connected" || fields[0].is_empty() {
                return None;
            }
            let link = match fields[1].as_str() {
                "ethernet" => Link::Ethernet,
                "wifi" => Link::Wifi,
                _ => return None,
            };
            Some((fields[0].clone(), link, fields[3..].join(":")))
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn links() -> CliResult<Vec<Network>> {
    let devices = output(
        "nmcli",
        &["--wait", "5", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device"],
    )?;
    let mut networks = Vec::new();
    for (interface, link, name) in nmcli_links(&devices) {
        let Some(address) = optional_output("nmcli", &["-g", "IP4.ADDRESS", "device", "show", &interface])
            .and_then(|addresses| ipv4(addresses.lines().next().unwrap_or("")).ok())
        else {
            continue;
        };
        let options = optional_output("nmcli", &["-g", "DHCP4.OPTION", "device", "show", &interface])
            .unwrap_or_default();
        let dhcp_dns = options
            .lines()
            .find_map(|line| line.strip_prefix("domain_name_servers = "))
            .unwrap_or("");
        let mut dns = dns_addresses(dhcp_dns);
        if dns.is_empty() {
            dns = dns_addresses(
                &optional_output("nmcli", &["-g", "IP4.DNS", "device", "show", &interface])
                    .unwrap_or_default(),
            );
        }
        networks.push(Network {
            name: if name.is_empty() { interface.clone() } else { name },
            interface,
            link,
            address,
            dns,
        });
    }
    Ok(networks)
}

#[cfg(target_os = "macos")]
fn links() -> CliResult<Vec<Network>> {
    use objc2_core_wlan::CWWiFiClient;
    // CoreWLAN returns retained, typed objects; these read-only selectors require
    // no caller-owned pointers or delegates. Without Location Services
    // permission the SSID is nil and the port name stands in.
    let client = unsafe { CWWiFiClient::sharedWiFiClient() };
    let ssids: Vec<(String, String)> = unsafe { client.interfaces() }
        .map(|interfaces| {
            interfaces
                .to_vec()
                .into_iter()
                .filter_map(|wifi| {
                    let interface = unsafe { wifi.interfaceName() }?.to_string();
                    let ssid = unsafe { wifi.ssid() }?.to_string();
                    Some((interface, ssid))
                })
                .collect()
        })
        .unwrap_or_default();
    let ports = output("/usr/sbin/networksetup", &["-listallhardwareports"])?;
    let mut networks = Vec::new();
    let mut port = String::new();
    for line in ports.lines() {
        if let Some(value) = line.strip_prefix("Hardware Port: ") {
            port = value.trim().to_string();
            continue;
        }
        let Some(interface) = line.strip_prefix("Device: ").map(str::trim) else {
            continue;
        };
        let Some(address) = optional_output("/usr/sbin/ipconfig", &["getifaddr", interface])
            .and_then(|value| ipv4(&value).ok())
        else {
            continue;
        };
        let packet = optional_output("/usr/sbin/ipconfig", &["getpacket", interface]).unwrap_or_default();
        let dns = packet
            .lines()
            .find_map(|line| {
                line.split_once("domain_name_server (ip_mult):")
                    .map(|(_, value)| value)
            })
            .unwrap_or("");
        let link = if matches!(port.as_str(), "Wi-Fi" | "AirPort") { Link::Wifi } else { Link::Ethernet };
        let name = ssids
            .iter()
            .find(|(name, _)| name == interface)
            .map(|(_, ssid)| ssid.clone())
            .unwrap_or_else(|| port.clone());
        networks.push(Network {
            interface: interface.to_string(),
            name,
            link,
            address,
            dns: dns_addresses(dns),
        });
    }
    Ok(networks)
}

#[cfg(target_os = "windows")]
fn links() -> CliResult<Vec<Network>> {
    // Physical adapters only, so VPN and virtual adapters are never candidates.
    // The connection profile name is the SSID on Wi-Fi and needs no Location permission.
    let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$networks = @()
foreach ($adapter in (Get-NetAdapter -Physical | Where-Object Status -eq 'Up')) {
    $link = switch ($adapter.PhysicalMediaType) { 'Native 802.11' { 'wifi' } '802.3' { 'ethernet' } default { '' } }
    if (-not $link) { continue }
    $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object AddressState -eq 'Preferred' | Select-Object -First 1
    if (-not $ip) { continue }
    $config = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object InterfaceIndex -eq $adapter.ifIndex
    $dns = @($config.DNSServerSearchOrder | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })
    $connection = Get-NetConnectionProfile -InterfaceIndex $adapter.ifIndex -ErrorAction SilentlyContinue | Select-Object -First 1
    $name = if ($connection -and $connection.Name) { $connection.Name } else { $adapter.Name }
    $networks += @{ interface = $adapter.Name; link = $link; name = $name; address = $ip.IPAddress; dns = $dns }
}
ConvertTo-Json -InputObject @($networks) -Compress
"#;
    let raw = output(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ],
    )?;
    #[derive(serde::Deserialize)]
    struct WindowsNetwork {
        interface: String,
        link: String,
        name: String,
        address: String,
        dns: Vec<String>,
    }
    let parsed: Vec<WindowsNetwork> = serde_json::from_str(&raw)
        .map_err(|_| "Windows did not return usable network metadata.".to_string())?;
    Ok(parsed
        .into_iter()
        .filter_map(|network| {
            Some(Network {
                address: ipv4(&network.address).ok()?,
                link: if network.link == "wifi" { Link::Wifi } else { Link::Ethernet },
                interface: network.interface,
                name: network.name,
                dns: dns_addresses(&network.dns.join(" ")),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dns_filters_duplicates_and_non_addresses() {
        assert_eq!(
            dns_addresses("{ 10.2.0.1, 10.2.0.2 }\n10.2.0.1|127.0.0.53 0.0.0.0 garbage"),
            vec![Ipv4Addr::new(10, 2, 0, 1), Ipv4Addr::new(10, 2, 0, 2)]
        );
    }
    fn network(interface: &str, link: Link, dns: Vec<Ipv4Addr>) -> Network {
        Network {
            interface: interface.into(),
            name: interface.into(),
            link,
            address: Ipv4Addr::new(10, 0, 0, 2),
            dns,
        }
    }
    #[test]
    fn candidates_put_ethernet_first_and_drop_links_without_dns() {
        let dns = vec![Ipv4Addr::new(10, 0, 0, 1)];
        let order: Vec<_> = candidates(vec![
            network("wlan0", Link::Wifi, dns.clone()),
            network("eth1", Link::Ethernet, Vec::new()),
            network("eth0", Link::Ethernet, dns),
        ])
        .into_iter()
        .map(|network| network.interface)
        .collect();
        assert_eq!(order, ["eth0", "wlan0"]);
    }
    #[test]
    fn nmcli_rows_keep_connected_wifi_and_ethernet_only() {
        let rows = "wlp0s20f3:wifi:connected:Hostel\\:AP\n\
                    enp4s0:ethernet:connected:Wired connection 1\n\
                    eth1:ethernet:unavailable:\n\
                    CloudflareWARP:tun:connected (externally):CloudflareWARP";
        assert_eq!(
            nmcli_links(rows),
            vec![
                ("wlp0s20f3".to_string(), Link::Wifi, "Hostel:AP".to_string()),
                ("enp4s0".to_string(), Link::Ethernet, "Wired connection 1".to_string()),
            ]
        );
    }
}
