mod dns;
mod network;

use crate::cli::WifixCommand;
use crate::common::{credentials, sel, CliResult, UA};
use network::Network;
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use scraper::Html;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;
use url::Url;

const PORTAL_HOST: &str = "auth.iiitkottayam.ac.in";
const PORTAL_BASE: &str = "https://auth.iiitkottayam.ac.in:1442";
const LOGIN_PATH: &str = "/login?0330598d1f22608a";
const LOGOUT_PATH: &str = "/logout?0307020009020400";
const PROBE_URL: &str = "http://connectivitycheck.gstatic.com/generate_204";

#[derive(Debug, PartialEq)]
enum Connectivity {
    Online,
    Captive,
    Unavailable,
}

pub(crate) fn run(command: Option<WifixCommand>) -> CliResult<()> {
    let network = network::discover()?;
    println!(
        "Campus Wi-Fi: {} ({}, {})",
        network.ssid, network.interface, network.address
    );
    let probe_client = Client::builder()
        .no_proxy()
        .local_address(IpAddr::V4(network.address))
        .redirect(Policy::none())
        .timeout(Duration::from_secs(10))
        .user_agent(UA)
        .build()
        .map_err(|_| "Could not initialize Wi-Fi connectivity check.")?;
    let before = probe(&probe_client);
    match command {
        Some(WifixCommand::Status) => {
            println!(
                "Wi-Fi status: {}",
                match before {
                    Connectivity::Online => "online",
                    Connectivity::Captive => "campus login required",
                    Connectivity::Unavailable => "connectivity check unavailable",
                }
            );
            if before == Connectivity::Unavailable {
                Err("Could not establish campus Wi-Fi connectivity.".into())
            } else {
                Ok(())
            }
        }
        Some(WifixCommand::Logout) => {
            if before == Connectivity::Captive {
                println!("Campus Wi-Fi is already logged out.");
                return Ok(());
            }
            let address = dns::resolve(network.address, &network.dns)?;
            let portal = portal_client(&network, address)?;
            logout(&portal, &probe_client)
        }
        _ => {
            if before == Connectivity::Online {
                println!("Campus Wi-Fi is already online.");
                return Ok(());
            }
            let address = dns::resolve(network.address, &network.dns)?;
            let portal = portal_client(&network, address)?;
            let (username, password) = credentials("lms")?;
            login(&portal, &probe_client, &username, &password)
        }
    }
}

fn portal_client(network: &Network, address: Ipv4Addr) -> CliResult<Client> {
    Client::builder()
        .no_proxy()
        .local_address(IpAddr::V4(network.address))
        .resolve(PORTAL_HOST, SocketAddr::from((address, 1442)))
        // Match the campus portal's certificate behavior, scoped to this client.
        // Redirects stay disabled and every request uses the fixed official origin.
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .redirect(Policy::none())
        .cookie_store(true)
        .timeout(Duration::from_secs(20))
        .user_agent(UA)
        .build()
        .map_err(|_| "Could not initialize campus portal connection.".into())
}

fn probe(client: &Client) -> Connectivity {
    let Ok(response) = client.get(PROBE_URL).send() else {
        return Connectivity::Unavailable;
    };
    let status = response.status().as_u16();
    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let body = response.text().unwrap_or_default();
    connectivity(status, location.as_deref(), &body)
}

fn connectivity(status: u16, location: Option<&str>, body: &str) -> Connectivity {
    if status == 204 && body.is_empty() {
        return Connectivity::Online;
    }
    let redirected = location
        .and_then(|value| Url::parse(value).ok())
        .is_some_and(|url| url.host_str() == Some(PORTAL_HOST));
    let portal_form = Html::parse_document(body)
        .select(&sel("input[name=magic]"))
        .next()
        .is_some();
    if (300..400).contains(&status) && redirected || status == 200 && portal_form {
        Connectivity::Captive
    } else {
        Connectivity::Unavailable
    }
}

fn login(portal: &Client, probe_client: &Client, username: &str, password: &str) -> CliResult<()> {
    let response = portal
        .get(format!("{PORTAL_BASE}{LOGIN_PATH}"))
        .send()
        .map_err(|_| "Campus portal login page could not be reached.")?;
    if !response.status().is_success() {
        return Err(format!(
            "Campus login page returned HTTP {}.",
            response.status()
        ));
    }
    let body = response
        .text()
        .map_err(|_| "Campus login page could not be read.")?;
    let (magic, redirect) = login_fields(&body)?;
    let mut fields = vec![
        ("magic", magic.as_str()),
        ("username", username),
        ("password", password),
    ];
    if let Some(redirect) = redirect.as_deref() {
        fields.push(("4Tredir", redirect));
    }
    let response = portal
        .post(format!("{PORTAL_BASE}/"))
        .form(&fields)
        .send()
        .map_err(|_| "Campus portal login request failed. Credentials were not logged.")?;
    if response.status().is_client_error() || response.status().is_server_error() {
        return Err(format!("Campus login returned HTTP {}.", response.status()));
    }
    verify(probe_client, Connectivity::Online)?;
    println!("Campus Wi-Fi login verified: internet access is available.");
    Ok(())
}

fn login_fields(body: &str) -> CliResult<(String, Option<String>)> {
    let html = Html::parse_document(body);
    let form = html
        .select(&sel("form"))
        .find(|form| form.select(&sel("input[name=magic]")).next().is_some())
        .ok_or("Campus portal did not return its login form; no credentials were sent.")?;
    if let Some(action) = form.value().attr("action") {
        let destination = Url::parse(PORTAL_BASE)
            .unwrap()
            .join(action)
            .map_err(|_| "Campus portal returned an invalid form action.")?;
        if destination.scheme() != "https"
            || destination.host_str() != Some(PORTAL_HOST)
            || destination.port_or_known_default() != Some(1442)
            || !destination.username().is_empty()
            || destination.password().is_some()
        {
            return Err("Campus portal returned a form outside its official origin; no credentials were sent.".into());
        }
    }
    let value = |name: &str| {
        form.select(&sel(&format!("input[name=\"{name}\"]")))
            .next()
            .and_then(|input| input.value().attr("value"))
            .map(str::to_owned)
    };
    let magic = value("magic")
        .filter(|value| !value.is_empty())
        .ok_or("Campus login form has no magic token; no credentials were sent.")?;
    Ok((magic, value("4Tredir")))
}

fn logout(portal: &Client, probe_client: &Client) -> CliResult<()> {
    let response = portal
        .get(format!("{PORTAL_BASE}{LOGOUT_PATH}"))
        .send()
        .map_err(|_| "Campus portal logout request failed.")?;
    if response.status().is_client_error() || response.status().is_server_error() {
        return Err(format!(
            "Campus logout returned HTTP {}.",
            response.status()
        ));
    }
    verify(probe_client, Connectivity::Captive)?;
    println!(
        "Campus Wi-Fi logout verified: portal login is required again. Wi-Fi remains connected."
    );
    Ok(())
}

fn verify(client: &Client, expected: Connectivity) -> CliResult<()> {
    for attempt in 0..3 {
        if attempt > 0 {
            std::thread::sleep(Duration::from_secs(1));
        }
        if probe(client) == expected {
            return Ok(());
        }
    }
    Err(if expected == Connectivity::Online {
        "The portal request completed, but internet access was not verified. Check your LMS credentials and campus connectivity; login was not retried."
    } else {
        "The logout request completed, but a return to the campus login portal was not verified. Check bunkialo wifix status."
    }.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_reordered_and_encoded_fields_and_rejects_foreign_action() {
        let body = r#"<form action="/"><input value="abc&amp;def" name="magic"><input name="4Tredir" value="https://example.com/?a=1&amp;b=2"></form>"#;
        assert_eq!(
            login_fields(body).unwrap(),
            (
                "abc&def".into(),
                Some("https://example.com/?a=1&b=2".into())
            )
        );
        assert!(
            login_fields(&body.replace("action=\"/\"", "action=\"https://evil.example\"")).is_err()
        );
        assert!(login_fields("<form><input name=magic value=''></form>").is_err());
    }
    #[test]
    fn distinguishes_logout_from_network_failure() {
        assert_eq!(connectivity(204, None, ""), Connectivity::Online);
        assert_eq!(
            connectivity(302, Some("https://auth.iiitkottayam.ac.in:1442/login"), ""),
            Connectivity::Captive
        );
        assert_eq!(
            connectivity(302, Some("https://other.example/"), ""),
            Connectivity::Unavailable
        );
        assert_eq!(connectivity(500, None, ""), Connectivity::Unavailable);
        assert_eq!(
            connectivity(200, None, "<input name='magic' value='123'>"),
            Connectivity::Captive
        );
        assert_eq!(
            connectivity(200, None, "ordinary page"),
            Connectivity::Unavailable
        );
    }
}
