use reqwest::blocking::{Client, Response};
use scraper::{ElementRef, Html, Selector};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use url::Url;

pub(crate) const SERVICE: &str = "bunkialo-cli";
const LEGACY_SERVICE: &str = "codex-acads-iiitk";
pub(crate) const LMS_DEFAULT: &str = "https://lmsug24.iiitkottayam.ac.in";
pub(crate) const ATTENDANCE_DEFAULT: &str = "https://attendance.iiitkottayam.ac.in";
pub(crate) const UA: &str = "bunkialo-cli/1.0 (interactive academic portal client)";

pub(crate) type CliResult<T> = Result<T, String>;

pub(crate) fn lms_base_url() -> CliResult<String> {
    let base = env::var("BUNKIALO_LMS_URL")
        .or_else(|_| env::var("ACADS_LMS_URL"))
        .unwrap_or_else(|_| LMS_DEFAULT.into());
    let parsed = Url::parse(&base).map_err(|_| {
        "LMS URL must use an official HTTPS lmsugYY.iiitkottayam.ac.in host.".to_string()
    })?;
    let cohort = parsed
        .host_str()
        .and_then(|host| host.strip_prefix("lmsug"))
        .and_then(|rest| rest.strip_suffix(".iiitkottayam.ac.in"));
    if parsed.scheme() != "https"
        || parsed.port().is_some()
        || !cohort.is_some_and(|year| year.len() >= 2 && year.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("LMS URL must use an official HTTPS lmsugYY.iiitkottayam.ac.in host.".into());
    }
    Ok(base)
}

pub(crate) fn attendance_base_url() -> CliResult<String> {
    let base = env::var("BUNKIALO_ATTENDANCE_URL")
        .or_else(|_| env::var("ACADS_ATTENDANCE_URL"))
        .unwrap_or_else(|_| ATTENDANCE_DEFAULT.into());
    let parsed = Url::parse(&base).map_err(|_| {
        "Attendance URL must use the official attendance.iiitkottayam.ac.in HTTPS host.".to_string()
    })?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("attendance.iiitkottayam.ac.in")
        || parsed.port().is_some()
    {
        return Err(
            "Attendance URL must use the official attendance.iiitkottayam.ac.in HTTPS host.".into(),
        );
    }
    Ok(base)
}

pub(crate) fn sel(query: &str) -> Selector {
    Selector::parse(query).expect("static selector")
}
pub(crate) fn text_of(node: ElementRef<'_>) -> String {
    compact(&node.text().collect::<Vec<_>>().join(" "))
}
pub(crate) fn compact(value: &str) -> String {
    let decoded = html_escape::decode_html_entities(value);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}
pub(crate) fn attr<'a>(node: ElementRef<'a>, name: &str) -> &'a str {
    node.value().attr(name).unwrap_or("")
}
pub(crate) fn has_class(node: ElementRef<'_>, class: &str) -> bool {
    node.value().classes().any(|value| value == class)
}
pub(crate) fn safe_url(base: &str, path: &str) -> CliResult<String> {
    let base_url = Url::parse(base).map_err(|_| "Invalid portal base URL.".to_string())?;
    let joined = base_url
        .join(path)
        .map_err(|_| "Portal returned an invalid URL.".to_string())?;
    if joined.host_str() != base_url.host_str()
        || joined.scheme() != "https"
        || joined.port_or_known_default() != base_url.port_or_known_default()
        || !joined.username().is_empty()
        || joined.password().is_some()
    {
        return Err("Portal returned a link outside its official HTTPS host; stopped.".into());
    }
    Ok(joined.to_string())
}
pub(crate) fn response_text(response: Response, service: &str) -> CliResult<String> {
    let status = response.status();
    let body = response.text().unwrap_or_default();
    if !status.is_success() {
        return Err(format!(
            "{service} request failed (HTTP {}).",
            status.as_u16()
        ));
    }
    Ok(body)
}
pub(crate) fn http_client() -> CliResult<Client> {
    Client::builder()
        .cookie_store(true)
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Could not initialize HTTP client ({}).", e))
}
pub(crate) fn http_client_for_host(base: &str) -> CliResult<Client> {
    let base = Url::parse(base).map_err(|_| "Invalid portal base URL.".to_string())?;
    let host = base
        .host_str()
        .ok_or("Portal base URL has no host.")?
        .to_string();
    let port = base.port_or_known_default();
    Client::builder()
        .cookie_store(true)
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= 10 {
                return attempt.stop();
            }
            let url = attempt.url();
            if url.scheme() == "https"
                && url.host_str() == Some(host.as_str())
                && url.port_or_known_default() == port
                && url.username().is_empty()
                && url.password().is_none()
            {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|e| format!("Could not initialize HTTP client ({}).", e))
}
pub(crate) fn page(source: &str) -> Html {
    Html::parse_document(source)
}
pub(crate) fn hidden_fields(form: ElementRef<'_>) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    for input in form.select(&sel("input[type=hidden][name]")) {
        fields.insert(
            attr(input, "name").to_string(),
            attr(input, "value").to_string(),
        );
    }
    fields
}
pub(crate) fn auth_entry(account: &str) -> CliResult<keyring::Entry> {
    keyring::Entry::new(SERVICE, account).map_err(|_| "OS keyring is unavailable.".to_string())
}
pub(crate) fn stored_value(account: &str) -> Option<String> {
    auth_entry(account)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .or_else(|| {
            keyring::Entry::new(LEGACY_SERVICE, account)
                .ok()?
                .get_password()
                .ok()
        })
}
pub(crate) fn credential_value(
    env_name: &str,
    account: &str,
    prompt: &str,
    secret: bool,
) -> CliResult<String> {
    if let Ok(value) = env::var(env_name) {
        if !value.is_empty() {
            return Ok(value);
        }
    }
    if let Some(legacy) = env_name.strip_prefix("BUNKIALO_") {
        if let Ok(value) = env::var(format!("ACADS_{legacy}")) {
            if !value.is_empty() {
                return Ok(value);
            }
        }
    }
    if let Some(value) = stored_value(account) {
        if !value.is_empty() {
            return Ok(value);
        }
    }
    let value = if secret {
        rpassword::prompt_password(prompt)
            .map_err(|_| "Could not read credential prompt.".to_string())?
    } else {
        input(prompt)?
    };
    if value.is_empty() {
        return Err("Both username/email and password are required.".into());
    }
    Ok(value)
}
pub(crate) fn credentials(provider: &str) -> CliResult<(String, String)> {
    if provider == "lms" {
        Ok((
            credential_value(
                "BUNKIALO_LMS_USERNAME",
                "lms.username",
                "LMS username: ",
                false,
            )?,
            credential_value(
                "BUNKIALO_LMS_PASSWORD",
                "lms.password",
                "LMS password: ",
                true,
            )?,
        ))
    } else {
        Ok((
            credential_value(
                "BUNKIALO_ATTENDANCE_EMAIL",
                "attendance.email",
                "Attendance email: ",
                false,
            )?,
            credential_value(
                "BUNKIALO_ATTENDANCE_PASSWORD",
                "attendance.password",
                "Attendance password: ",
                true,
            )?,
        ))
    }
}
pub(crate) fn input(prompt: &str) -> CliResult<String> {
    print!("{prompt}");
    io::stdout()
        .flush()
        .map_err(|_| "Could not write prompt.".to_string())?;
    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .map_err(|_| "Could not read terminal input.".to_string())?;
    Ok(value.trim().to_string())
}
pub(crate) fn print_json(value: &Value) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).unwrap_or_else(|_| "null".into())
    );
}
pub(crate) fn value_string(value: &Value, key: &str) -> String {
    value
        .get(key)
        .map(|v| {
            v.as_str().map(str::to_string).unwrap_or_else(|| {
                if v.is_number() || v.is_boolean() {
                    v.to_string()
                } else {
                    String::new()
                }
            })
        })
        .unwrap_or_default()
}
pub(crate) fn value_arr(value: &Value, key: &str) -> Vec<Value> {
    value
        .get(key)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

pub(crate) fn expand_path(path: &str) -> PathBuf {
    if path == "~" {
        return env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(path));
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_default()
            .join(rest);
    }
    Path::new(path).to_path_buf()
}
