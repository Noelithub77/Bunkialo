use crate::common::CliResult;
use std::net::Ipv4Addr;
use std::process::Command;

#[derive(Debug)]
pub(super) struct Network {
    pub interface: String,
    pub ssid: String,
    pub address: Ipv4Addr,
    pub dns: Vec<Ipv4Addr>,
}

impl Network {
    pub fn ensure_route(&self, destination: Ipv4Addr) -> CliResult<()> {
        #[cfg(target_os = "windows")]
        {
            let script = format!("$ErrorActionPreference='Stop'; $wifi=Get-NetIPAddress -IPAddress '{}' -AddressFamily IPv4; $route=Find-NetRoute -RemoteIPAddress '{}' | Where-Object {{ $_.CimClass.CimClassName -eq 'MSFT_NetRoute' }}; if (-not $route -or $route.InterfaceIndex -ne $wifi.InterfaceIndex) {{ throw 'Destination routes through another interface. Configure VPN split tunneling for campus Wi-Fi.' }}", self.address, destination);
            output("powershell.exe", &["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", &script])
                .map_err(|_| "The Windows route does not select campus Wi-Fi. Configure VPN split tunneling and retry; routes were not changed.".to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        let _ = destination;
        Ok(())
    }

    pub fn validate(self) -> CliResult<Self> {
        if !matches!(self.ssid.as_str(), "IIITKottayam" | "IIITKottayam_5G") {
            return Err(format!(
                "WiFix only handles IIITKottayam and IIITKottayam_5G; current SSID is {:?}.",
                self.ssid
            ));
        }
        if self.address.is_unspecified() || self.address.is_loopback() || self.dns.is_empty() {
            return Err("Campus Wi-Fi has no usable IPv4 address or DNS servers.".into());
        }
        Ok(self)
    }
}

fn output(program: &str, args: &[&str]) -> CliResult<String> {
    let result = Command::new(program)
        .args(args)
        .env("LC_ALL", "C")
        .output()
        .map_err(|_| format!("Could not run {program}; install it or check that it is on PATH."))?;
    if !result.status.success() {
        return Err(format!(
            "{program} could not inspect Wi-Fi. Check its service and network permissions."
        ));
    }
    Ok(String::from_utf8_lossy(&result.stdout).trim().to_string())
}

fn ipv4(value: &str) -> CliResult<Ipv4Addr> {
    value
        .trim()
        .split('/')
        .next()
        .unwrap_or("")
        .parse()
        .map_err(|_| "Active Wi-Fi has no usable IPv4 address.".into())
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

#[cfg(target_os = "linux")]
pub(super) fn discover() -> CliResult<Network> {
    let devices = output(
        "nmcli",
        &["--wait", "5", "-t", "-f", "DEVICE,TYPE,STATE", "device"],
    )?;
    let mut networks = Vec::new();
    for line in devices.lines() {
        let fields: Vec<_> = line.split(':').collect();
        if fields.len() != 3 || fields[1] != "wifi" || fields[2] != "connected" {
            continue;
        }
        let interface = fields[0];
        let scan = output(
            "nmcli",
            &[
                "--wait",
                "5",
                "-t",
                "-f",
                "ACTIVE,SSID",
                "device",
                "wifi",
                "list",
                "ifname",
                interface,
                "--rescan",
                "no",
            ],
        )?;
        let ssid = scan
            .lines()
            .find_map(|row| row.strip_prefix("yes:"))
            .unwrap_or("");
        if !matches!(ssid, "IIITKottayam" | "IIITKottayam_5G") {
            continue;
        }
        let addresses = output("nmcli", &["-g", "IP4.ADDRESS", "device", "show", interface])?;
        let options = output(
            "nmcli",
            &["-g", "DHCP4.OPTION", "device", "show", interface],
        )?;
        let dhcp_dns = options
            .lines()
            .find_map(|line| line.strip_prefix("domain_name_servers = "))
            .unwrap_or("");
        let mut dns = dns_addresses(dhcp_dns);
        if dns.is_empty() {
            dns = dns_addresses(&output(
                "nmcli",
                &["-g", "IP4.DNS", "device", "show", interface],
            )?);
        }
        networks.push(Network {
            interface: interface.into(),
            ssid: ssid.into(),
            address: ipv4(addresses.lines().next().unwrap_or(""))?,
            dns,
        });
    }
    only_network(networks)
}

#[cfg(target_os = "macos")]
pub(super) fn discover() -> CliResult<Network> {
    use objc2_core_wlan::CWWiFiClient;
    // CoreWLAN returns retained, typed objects; these read-only selectors require
    // no caller-owned pointers or delegates. Missing SSID permission returns nil.
    let client = unsafe { CWWiFiClient::sharedWiFiClient() };
    let interfaces =
        unsafe { client.interfaces() }.ok_or("macOS could not enumerate Wi-Fi interfaces.")?;
    let mut networks = Vec::new();
    for wifi in interfaces.to_vec() {
        let Some(ssid) = (unsafe { wifi.ssid() }) else {
            continue;
        };
        let ssid = ssid.to_string();
        if !matches!(ssid.as_str(), "IIITKottayam" | "IIITKottayam_5G") {
            continue;
        }
        let Some(interface) = (unsafe { wifi.interfaceName() }) else {
            continue;
        };
        let interface = interface.to_string();
        let packet = output("/usr/sbin/ipconfig", &["getpacket", &interface])?;
        let dns = packet
            .lines()
            .find_map(|line| {
                line.split_once("domain_name_server (ip_mult):")
                    .map(|(_, value)| value)
            })
            .unwrap_or("");
        networks.push(Network {
            address: ipv4(&output("/usr/sbin/ipconfig", &["getifaddr", &interface])?)?,
            interface,
            ssid,
            dns: dns_addresses(dns),
        });
    }
    only_network(networks).map_err(|error| format!("{error} macOS may require Location Services permission for your terminal to reveal the SSID."))
}

#[cfg(target_os = "windows")]
pub(super) fn discover() -> CliResult<Network> {
    // Match each WLAN block to its adapter GUID, so Ethernet/VPN DNS cannot be selected.
    let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$blocks = ((netsh wlan show interfaces) -join "`n") -split '(?:\r?\n){2,}'
$networks = @()
foreach ($adapter in (Get-NetAdapter | Where-Object Status -eq 'Up')) {
    $guid = $adapter.InterfaceGuid.ToString().Trim('{}')
    foreach ($block in $blocks) {
        if ($block -notmatch [regex]::Escape($guid)) { continue }
        $match = [regex]::Match($block, '(?m)^\s*SSID\s*:\s*(.+?)\s*$')
        if (-not $match.Success) { continue }
        $ssid = $match.Groups[1].Value
        if ($ssid -notin @('IIITKottayam', 'IIITKottayam_5G')) { continue }
        $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 | Where-Object AddressState -eq 'Preferred' | Select-Object -First 1
        $config = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object InterfaceIndex -eq $adapter.ifIndex
        $dns = @($config.DNSServerSearchOrder | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' })
        $networks += @{ interface = $adapter.Name; ssid = $ssid; address = $ip.IPAddress; dns = $dns }
    }
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
        ssid: String,
        address: String,
        dns: Vec<String>,
    }
    let parsed: Vec<WindowsNetwork> = serde_json::from_str(&raw)
        .map_err(|_| "Windows did not return usable Wi-Fi metadata.".to_string())?;
    let networks = parsed
        .into_iter()
        .map(|network| {
            Ok(Network {
                interface: network.interface,
                ssid: network.ssid,
                address: ipv4(&network.address)?,
                dns: dns_addresses(&network.dns.join(" ")),
            })
        })
        .collect::<CliResult<Vec<_>>>()?;
    only_network(networks).map_err(|error| {
        format!("{error} Windows may require Location permission to reveal the SSID.")
    })
}

fn only_network(mut networks: Vec<Network>) -> CliResult<Network> {
    if networks.len() != 1 {
        return Err("Connect exactly one Wi-Fi interface to IIITKottayam or IIITKottayam_5G first; no network settings were changed.".into());
    }
    networks.remove(0).validate()
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
    #[test]
    fn refuses_non_campus_and_ambiguous_networks() {
        let network = Network {
            interface: "wlan0".into(),
            ssid: "Home".into(),
            address: Ipv4Addr::new(10, 0, 0, 2),
            dns: vec![Ipv4Addr::new(10, 0, 0, 1)],
        };
        assert!(network.validate().is_err());
        assert!(only_network(Vec::new()).is_err());
    }
}
