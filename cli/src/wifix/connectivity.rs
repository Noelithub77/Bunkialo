use super::{dns, network::Network, PORTAL_HOST};
use crate::common::{sel, CliResult, UA};
use reqwest::blocking::{Client, ClientBuilder, Response};
use reqwest::redirect::Policy;
use scraper::Html;
use std::io::Read;
use std::net::{IpAddr, SocketAddr};
use std::time::{Duration, Instant};
use url::Url;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Connectivity {
    Online,
    Captive,
    Unavailable,
}

struct Endpoint {
    url: &'static str,
    status: u16,
    body: &'static str,
}
const ENDPOINTS: [Endpoint; 3] = [
    Endpoint {
        url: "http://connectivitycheck.gstatic.com/generate_204",
        status: 204,
        body: "",
    },
    Endpoint {
        url: "http://www.msftconnecttest.com/connecttest.txt",
        status: 200,
        body: "Microsoft Connect Test",
    },
    Endpoint {
        url: "http://firefox-portal-detection.com/generate_204",
        status: 204,
        body: "",
    },
];

pub(super) fn builder(network: &Network) -> ClientBuilder {
    let builder = Client::builder()
        .no_proxy()
        .local_address(IpAddr::V4(network.address))
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(3))
        .user_agent(UA);
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    let builder = builder.interface(&network.interface);
    builder
}

pub(super) fn read_body(response: Response) -> CliResult<String> {
    let mut bytes = Vec::new();
    response
        .take(262145)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read network response: {error}"))?;
    if bytes.len() > 262144 {
        return Err("Network response exceeded the size limit.".into());
    }
    String::from_utf8(bytes).map_err(|_| "Network response was not UTF-8.".into())
}

pub(super) fn probe(network: &Network) -> Connectivity {
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut captive = false;
    for endpoint in &ENDPOINTS {
        if Instant::now() >= deadline {
            break;
        }
        let result = probe_endpoint(network, endpoint, deadline);
        match result {
            Ok(Connectivity::Online) => return Connectivity::Online,
            Ok(Connectivity::Captive) => captive = true,
            Ok(Connectivity::Unavailable) => eprintln!(
                "Wi-Fi check {} returned an unexpected response.",
                endpoint.url
            ),
            Err(error) => eprintln!("Wi-Fi check {}: {error}", endpoint.url),
        }
    }
    if captive {
        Connectivity::Captive
    } else {
        Connectivity::Unavailable
    }
}

fn probe_endpoint(
    network: &Network,
    endpoint: &Endpoint,
    deadline: Instant,
) -> CliResult<Connectivity> {
    let url = Url::parse(endpoint.url).map_err(|_| "Invalid connectivity endpoint.")?;
    let host = url.host_str().ok_or("Connectivity endpoint has no host.")?;
    let address = dns::resolve(network, host, deadline)?;
    network.ensure_route(address)?;
    let timeout = deadline
        .saturating_duration_since(Instant::now())
        .min(Duration::from_secs(4));
    if timeout.is_zero() {
        return Err("Connectivity check deadline reached.".into());
    }
    let client = builder(network)
        .resolve(host, SocketAddr::from((address, 80)))
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Could not create Wi-Fi HTTP client: {error}"))?;
    let response = client.get(endpoint.url).send().map_err(request_error)?;
    let status = response.status().as_u16();
    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let body = read_body(response)?;
    Ok(classify(
        status,
        location.as_deref(),
        &body,
        endpoint.status,
        endpoint.body,
    ))
}

pub(super) fn request_error(error: reqwest::Error) -> String {
    use std::error::Error;
    let error = error.without_url();
    let mut message = error.to_string();
    let mut source = error.source();
    for _ in 0..5 {
        let Some(cause) = source else {
            break;
        };
        let detail = cause.to_string();
        if !message.ends_with(&detail) {
            message.push_str(&format!(": {detail}"));
        }
        source = cause.source();
    }
    message
}

pub(super) fn classify(
    status: u16,
    location: Option<&str>,
    body: &str,
    expected_status: u16,
    expected_body: &str,
) -> Connectivity {
    if status == expected_status && body.trim() == expected_body {
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

pub(super) fn verify(network: &Network, expected: Connectivity) -> CliResult<()> {
    for attempt in 0..2 {
        if attempt > 0 {
            std::thread::sleep(Duration::from_secs(1));
        }
        if probe(network) == expected {
            return Ok(());
        }
    }
    Err(if expected == Connectivity::Online {
        "The portal request completed, but internet access was not verified. Check campus connectivity and VPN routing; the login was not repeated."
    } else {
        "The logout request completed, but a return to the campus login portal was not verified. Check bunkialo wifix status."
    }.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoint_contracts_and_captive_responses() {
        assert_eq!(classify(204, None, "", 204, ""), Connectivity::Online);
        assert_eq!(
            classify(
                200,
                None,
                "Microsoft Connect Test",
                200,
                "Microsoft Connect Test"
            ),
            Connectivity::Online
        );
        assert_eq!(
            classify(200, None, "ordinary page", 200, "Microsoft Connect Test"),
            Connectivity::Unavailable
        );
        assert_eq!(
            classify(
                302,
                Some("https://auth.iiitkottayam.ac.in:1442/login"),
                "",
                204,
                ""
            ),
            Connectivity::Captive
        );
        assert_eq!(
            classify(302, Some("https://other.example"), "", 204, ""),
            Connectivity::Unavailable
        );
        assert_eq!(
            classify(200, None, "<input name=magic value=abc>", 204, ""),
            Connectivity::Captive
        );
        assert_eq!(classify(500, None, "", 204, ""), Connectivity::Unavailable);
    }
}
