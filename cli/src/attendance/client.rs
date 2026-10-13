use crate::common::*;
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, AUTHORIZATION};
use serde_json::{json, Value};
use std::collections::HashMap;

pub(crate) struct Attendance {
    base: String,
    email: String,
    password: String,
    client: Client,
    access: Option<String>,
    refresh: Option<String>,
}
impl Attendance {
    pub(crate) fn new(base: String, email: String, password: String) -> CliResult<Self> {
        Ok(Self {
            base: base.trim_end_matches('/').into(),
            email,
            password,
            client: http_client()?,
            access: None,
            refresh: None,
        })
    }
    pub(super) fn request_json(
        &self,
        path: &str,
        payload: Option<&Value>,
        authenticated: bool,
    ) -> CliResult<Value> {
        let url = safe_url(&self.base, path)?;
        let mut req = if let Some(data) = payload {
            self.client.post(url).json(data)
        } else {
            self.client.get(url)
        }
        .header(ACCEPT, "application/json");
        if authenticated {
            if let Some(token) = &self.access {
                req = req.header(AUTHORIZATION, format!("Bearer {token}"));
            }
        }
        let response = req
            .send()
            .map_err(|e| format!("Could not reach attendance portal ({}).", e))?;
        let status = response.status();
        let body = response.text().unwrap_or_default();
        if !status.is_success() {
            if status.as_u16() == 401 || status.as_u16() == 403 {
                return Err("Attendance portal rejected the sign-in or session.".into());
            }
            return Err(format!(
                "Attendance portal request failed (HTTP {}).",
                status.as_u16()
            ));
        }
        if body.trim().is_empty() {
            return Ok(json!({}));
        }
        serde_json::from_str(&body).map_err(|_| "Attendance portal returned invalid JSON.".into())
    }
    pub(crate) fn login(&mut self) -> CliResult<()> {
        let result = self.request_json(
            "/api/auth/login",
            Some(&json!({"email":self.email,"password":self.password})),
            false,
        )?;
        if result
            .get("needs2fa")
            .and_then(Value::as_bool)
            .unwrap_or(false)
            || result
                .get("needsEmailOtp")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        {
            return Err("Attendance sign-in requires a verification code; complete it in the portal, then retry the read command.".into());
        }
        self.access = result
            .get("access")
            .or_else(|| result.get("accessToken"))
            .and_then(Value::as_str)
            .map(str::to_string);
        self.refresh = result
            .get("refresh")
            .or_else(|| result.get("refreshToken"))
            .and_then(Value::as_str)
            .map(str::to_string);
        if self.access.is_none() || self.refresh.is_none() {
            return Err("Attendance sign-in returned no usable session tokens.".into());
        }
        Ok(())
    }
    pub(super) fn get(&self, path: &str) -> CliResult<Value> {
        self.request_json(path, None, true)
    }
    pub(super) fn multipart(
        &self,
        path: &str,
        fields: &HashMap<String, String>,
        file_path: &str,
    ) -> CliResult<Value> {
        let file = expand_path(file_path);
        if !file.is_file() {
            return Err(format!("Certificate file not found: {file_path}"));
        }
        let ext = file
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !["pdf", "jpg", "jpeg", "png", "heic", "heif", "webp"].contains(&ext.as_str()) {
            return Err(
                "Certificate must be a PDF or image (JPG, PNG, HEIC, HEIF, or WebP).".into(),
            );
        }
        let mut form = reqwest::blocking::multipart::Form::new();
        for (k, v) in fields {
            form = form.text(k.clone(), v.clone());
        }
        let name = file
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("certificate")
            .to_string();
        let part = reqwest::blocking::multipart::Part::file(&file)
            .map_err(|_| "Could not read medical certificate file.".to_string())?
            .file_name(name)
            .mime_str(
                mime_guess::from_path(&file)
                    .first_or_octet_stream()
                    .as_ref(),
            )
            .map_err(|_| "Invalid certificate MIME type.".to_string())?;
        form = form.part("certificate", part);
        let url = safe_url(&self.base, path)?;
        let mut request = self.client.post(url).header(ACCEPT, "application/json");
        if let Some(token) = &self.access {
            request = request.header(AUTHORIZATION, format!("Bearer {token}"));
        }
        let response = request
            .multipart(form)
            .send()
            .map_err(|e| format!("Medical leave upload failed ({}).", e))?;
        let status = response.status();
        let body = response.text().unwrap_or_default();
        if !status.is_success() {
            let error = serde_json::from_str::<Value>(&body)
                .ok()
                .and_then(|v| v.get("error").and_then(Value::as_str).map(str::to_string));
            if status.as_u16() == 401 || status.as_u16() == 403 {
                return Err("Attendance portal rejected the sign-in or session.".into());
            }
            return Err(format!(
                "Medical leave request failed (HTTP {}{}).",
                status.as_u16(),
                error.map(|e| format!(": {e}")).unwrap_or_default()
            ));
        }
        if body.trim().is_empty() {
            Ok(json!({}))
        } else {
            serde_json::from_str(&body).map_err(|_| {
                "Attendance portal returned invalid JSON after medical leave submission.".into()
            })
        }
    }
    pub(crate) fn logout(&mut self) {
        if let Some(refresh) = self.refresh.take() {
            let _ = self.request_json("/api/auth/logout", Some(&json!({"refresh":refresh})), false);
        }
        self.access = None;
    }
}
