use crate::attendance::Attendance;
use crate::common::{attendance_base_url, auth_entry, lms_base_url, CliResult};
use crate::lms::Moodle;
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
use serde_json::json;
use std::io::Read;
use std::time::{Duration, Instant};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

const INDEX: &str = include_str!("../login-ui/dist/index.html");
const SCRIPT: &str = include_str!("../login-ui/dist/assets/app.js");
const STYLE: &str = include_str!("../login-ui/dist/assets/index.css");
const MAX_BODY: u64 = 8192;

#[derive(Deserialize)]
struct LmsLogin {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct AttendanceLogin {
    email: String,
    password: String,
}

struct LoginState {
    lms: Option<LmsLogin>,
    completed: bool,
}

pub(crate) fn run() -> CliResult<()> {
    let server = Server::http("127.0.0.1:0")
        .map_err(|_| "Could not start a localhost login page.".to_string())?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or("Local login address is unavailable.")?
        .port();
    let origin = format!("http://127.0.0.1:{port}");
    let mut nonce = [0u8; 32];
    OsRng.fill_bytes(&mut nonce);
    let token = nonce
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let url = format!("{origin}/#{token}");
    println!("Opening Bunkialo sign in at {url}");
    if !crate::browser::open(&url) {
        println!("Open this one-time local URL in your browser: {url}");
    }
    let mut state = LoginState {
        lms: None,
        completed: false,
    };
    let deadline = Instant::now() + Duration::from_secs(600);
    while Instant::now() < deadline {
        let Some(request) = server
            .recv_timeout(Duration::from_secs(1))
            .map_err(|_| "Local login server stopped unexpectedly.".to_string())?
        else {
            continue;
        };
        let completed = handle_request(request, &origin, &token, &mut state);
        if completed {
            println!("LMS and attendance credentials saved in the OS keyring.");
            return Ok(());
        }
    }
    Err(
        "Browser login timed out after 10 minutes; check `bunkialo auth status` before retrying."
            .into(),
    )
}

fn header<'a>(request: &'a Request, name: &str) -> Option<&'a str> {
    request
        .headers()
        .iter()
        .find(|entry| entry.field.to_string().eq_ignore_ascii_case(name))
        .map(|entry| entry.value.as_str())
}

fn response(
    status: u16,
    content_type: &str,
    body: impl Into<Vec<u8>>,
) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut result = Response::from_data(body.into()).with_status_code(StatusCode(status));
    for (name,value) in [
        ("Content-Type",content_type),
        ("Cache-Control","no-store"),
        ("X-Content-Type-Options","nosniff"),
        ("Referrer-Policy","no-referrer"),
        ("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"),
    ] {
        result.add_header(Header::from_bytes(name,value).expect("static HTTP header"));
    }
    result
}

fn json_reply(status: u16, message: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    response(
        status,
        "application/json; charset=utf-8",
        json!({"ok":status == 200,"message":message})
            .to_string()
            .into_bytes(),
    )
}

fn handle_request(mut request: Request, origin: &str, token: &str, state: &mut LoginState) -> bool {
    let expected_host = origin.trim_start_matches("http://");
    let host_ok = header(&request, "Host") == Some(expected_host);
    let remote_ok = request
        .remote_addr()
        .is_some_and(|addr| addr.ip().is_loopback());
    if !host_ok || !remote_ok {
        let _ = request.respond(json_reply(403, "Local browser request rejected."));
        return false;
    }
    if request.method() == &Method::Get {
        let reply = match request.url() {
            "/" => response(200, "text/html; charset=utf-8", INDEX.as_bytes()),
            "/assets/app.js" => response(200, "text/javascript; charset=utf-8", SCRIPT.as_bytes()),
            "/assets/index.css" => response(200, "text/css; charset=utf-8", STYLE.as_bytes()),
            _ => json_reply(404, "Page not found."),
        };
        let _ = request.respond(reply);
        return false;
    }
    if request.method() != &Method::Post
        || !["/api/lms", "/api/attendance"].contains(&request.url())
    {
        let _ = request.respond(json_reply(405, "Unsupported local login request."));
        return false;
    }
    if header(&request, "Origin") != Some(origin)
        || header(&request, "X-Bunkialo-Token") != Some(token)
        || !header(&request, "Content-Type")
            .is_some_and(|value| value.starts_with("application/json"))
    {
        let _ = request.respond(json_reply(403, "Local login request was not authorized."));
        return false;
    }
    let mut body = Vec::new();
    if request
        .as_reader()
        .take(MAX_BODY + 1)
        .read_to_end(&mut body)
        .is_err()
        || body.len() as u64 > MAX_BODY
    {
        let _ = request.respond(json_reply(413, "Login form was too large."));
        return false;
    }
    let result = if request.url() == "/api/lms" {
        validate_lms(&body, state)
    } else {
        validate_attendance_and_save(&body, state)
    };
    let (status, message) = match result {
        Ok(message) => (200, message),
        Err(message) => (400, message),
    };
    let _ = request.respond(json_reply(status, &message));
    state.completed
}

fn valid_field(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 512 && !value.contains(['\r', '\n', '\0'])
}

fn validate_lms(body: &[u8], state: &mut LoginState) -> CliResult<String> {
    let credentials: LmsLogin = serde_json::from_slice(body)
        .map_err(|_| "Enter your LMS roll number and password.".to_string())?;
    if !valid_field(&credentials.username) || !valid_field(&credentials.password) {
        return Err("Enter a valid LMS roll number and password.".into());
    }
    let client = Moodle::new(
        lms_base_url()?,
        credentials.username.clone(),
        credentials.password.clone(),
    )?;
    client.login()?;
    state.lms = Some(credentials);
    Ok("LMS account connected. Continue with attendance.".into())
}

fn validate_attendance_and_save(body: &[u8], state: &mut LoginState) -> CliResult<String> {
    let lms = state
        .lms
        .as_ref()
        .ok_or("Connect your LMS account first.")?;
    let credentials: AttendanceLogin = serde_json::from_slice(body)
        .map_err(|_| "Enter your institute email and attendance password.".to_string())?;
    if !valid_field(&credentials.email)
        || !credentials.email.contains('@')
        || !valid_field(&credentials.password)
    {
        return Err("Enter a valid institute email and attendance password.".into());
    }
    let mut client = Attendance::new(
        attendance_base_url()?,
        credentials.email.clone(),
        credentials.password.clone(),
    )?;
    client.login()?;
    client.logout();
    for (account, value) in [
        ("lms.username", lms.username.as_str()),
        ("lms.password", lms.password.as_str()),
        ("attendance.email", credentials.email.as_str()),
        ("attendance.password", credentials.password.as_str()),
    ] {
        auth_entry(account)?.set_password(value).map_err(|_| {
            "The OS keyring refused a credential. Check `bunkialo auth status` before retrying."
                .to_string()
        })?;
    }
    state.completed = true;
    Ok("Accounts connected and saved in your OS keyring.".into())
}
