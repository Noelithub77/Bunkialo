mod connectivity;
mod dns;
mod network;

use crate::cli::WifixCommand;
use crate::common::{credentials, sel, CliResult};
use connectivity::{probe, verify, Connectivity};
use network::Network;
use reqwest::blocking::Client;
use scraper::Html;
use std::net::{Ipv4Addr, SocketAddr};
use std::time::{Duration, Instant};
use url::Url;

const PORTAL_HOST: &str = "auth.iiitkottayam.ac.in";
const PORTAL_BASE: &str = "https://auth.iiitkottayam.ac.in:1442";
const LOGIN_PATH: &str = "/login?0330598d1f22608a";
const LOGOUT_PATH: &str = "/logout?0307020009020400";
pub(crate) fn run(command: Option<WifixCommand>) -> CliResult<()> {
    let mut network = network::discover()?;
    let mut refreshes = 0;
    let (network, before) = loop {
        println!(
            "Campus Wi-Fi: {} ({}, {})",
            network.ssid, network.interface, network.address
        );
        let state = probe(&network);
        let fresh = network::discover()?;
        if fresh.interface == network.interface
            && fresh.ssid == network.ssid
            && fresh.address == network.address
        {
            break (fresh, state);
        }
        if refreshes >= 1 {
            return Err(
                "Wi-Fi changed repeatedly during the check. Wait for it to settle, then retry."
                    .into(),
            );
        }
        eprintln!(
            "Wi-Fi changed during the check; refreshing the connection before any portal action."
        );
        network = fresh;
        refreshes += 1;
    };
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
            let address = dns::resolve(
                &network,
                PORTAL_HOST,
                Instant::now() + Duration::from_secs(6),
            )?;
            let portal = portal_client(&network, address)?;
            logout(&portal, &network)
        }
        _ => {
            if before == Connectivity::Online {
                println!("Campus Wi-Fi is already online.");
                return Ok(());
            }
            let address = dns::resolve(
                &network,
                PORTAL_HOST,
                Instant::now() + Duration::from_secs(6),
            )?;
            let portal = portal_client(&network, address)?;
            let (username, password) = credentials("lms")?;
            login(&portal, &network, &username, &password)
        }
    }
}

fn portal_client(network: &Network, address: Ipv4Addr) -> CliResult<Client> {
    network.ensure_route(address)?;
    connectivity::builder(network)
        .resolve(PORTAL_HOST, SocketAddr::from((address, 1442)))
        // Match the campus portal's certificate behavior, scoped to this client.
        // Redirects stay disabled and every request uses the fixed official origin.
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .cookie_store(true)
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "Could not initialize campus portal connection.".into())
}

fn login(portal: &Client, network: &Network, username: &str, password: &str) -> CliResult<()> {
    let response = portal
        .get(format!("{PORTAL_BASE}{LOGIN_PATH}"))
        .send()
        .map_err(|error| {
            format!(
                "Campus portal login page could not be reached: {}",
                connectivity::request_error(error)
            )
        })?;
    if !response.status().is_success() {
        return Err(format!(
            "Campus login page returned HTTP {}.",
            response.status()
        ));
    }
    let body = connectivity::read_body(response)?;
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
    verify(network, Connectivity::Online)?;
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

fn logout(portal: &Client, network: &Network) -> CliResult<()> {
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
    verify(network, Connectivity::Captive)?;
    println!(
        "Campus Wi-Fi logout verified: portal login is required again. Wi-Fi remains connected."
    );
    Ok(())
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
}
