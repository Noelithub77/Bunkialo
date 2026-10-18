use super::Attendance;
use crate::cli::AttendanceCommand;
use crate::common::*;
use chrono::{Local, NaiveDate, NaiveDateTime, TimeZone, Utc};
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::io::{self, IsTerminal};
use std::path::Path;

fn print_app_result(label: &str, result: &Value) {
    println!("{label} application sent to the attendance portal.");
    for key in ["id", "status", "message"] {
        if let Some(v) = result.get(key).filter(|v| v.is_string() || v.is_number()) {
            println!(
                "{key}: {}",
                v.as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| v.to_string())
            );
        }
    }
}
fn prompt_date(label: &str) -> CliResult<String> {
    let value = input(&format!("{label} (YYYY-MM-DD): "))?;
    NaiveDate::parse_from_str(&value, "%Y-%m-%d")
        .map_err(|_| format!("{label} must use YYYY-MM-DD."))?;
    Ok(value)
}
fn prompt_datetime(label: &str, optional: bool) -> CliResult<Option<String>> {
    let value = input(&format!(
        "{label} (YYYY-MM-DD HH:MM{}): ",
        if optional { ", optional" } else { "" }
    ))?;
    if value.is_empty() && optional {
        return Ok(None);
    }
    let parsed = NaiveDateTime::parse_from_str(&value, "%Y-%m-%d %H:%M")
        .map_err(|_| format!("{label} must use YYYY-MM-DD HH:MM."))?;
    let local = Local
        .from_local_datetime(&parsed)
        .single()
        .ok_or("This local time is ambiguous or invalid; choose another time.")?;
    Ok(Some(
        local
            .with_timezone(&Utc)
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    ))
}
fn collect_personal_leave() -> CliResult<Value> {
    let start = prompt_date("Leave from")?;
    let end = prompt_date("Leave to")?;
    if end < start {
        return Err("Leave end date must be on or after the start date.".into());
    }
    let departure = prompt_datetime("Intended departure date and time", false)?.unwrap();
    let returned = prompt_datetime("Intended return date and time", false)?.unwrap();
    if returned <= departure {
        return Err("Intended return must be after the departure time.".into());
    }
    let reason = input("Reason (at least 5 characters): ")?;
    if reason.chars().count() < 5 {
        return Err("Personal leave reason must be at least 5 characters.".into());
    }
    let address = input("Destination address (at least 3 characters): ")?;
    if address.chars().count() < 3 {
        return Err("Destination address must be at least 3 characters.".into());
    }
    let phone = input("Contact number during leave: ")?;
    let mut normalized = phone.replace([' ', '-'], "");
    for prefix in ["+91", "91", "0"] {
        if let Some(rest) = normalized.strip_prefix(prefix) {
            normalized = rest.to_string();
            break;
        }
    }
    if !Regex::new(r"^[6-9]\d{9}$").unwrap().is_match(&normalized) {
        return Err("Contact number must be a valid Indian 10-digit mobile number.".into());
    }
    if start < Local::now().format("%Y-%m-%d").to_string() {
        return Err("Personal leave start date cannot be in the past.".into());
    }
    Ok(
        json!({"fromDate":start,"toDate":end,"intendedExitAt":departure,"intendedReturnAt":returned,"reason":reason,"destinationAddress":address,"contactNumber":phone}),
    )
}
fn collect_medical_leave() -> CliResult<(HashMap<String, String>, String)> {
    let start = prompt_date("Medical leave from")?;
    let end = prompt_date("Medical leave to")?;
    if end < start {
        return Err("Medical leave end date must be on or after the start date.".into());
    }
    let slot = input("Slot (FULL_DAY, FN, AN) [FULL_DAY]: ")?.to_uppercase();
    let slot = if slot.is_empty() {
        "FULL_DAY".to_string()
    } else {
        slot
    };
    if !["FULL_DAY", "FN", "AN"].contains(&slot.as_str()) {
        return Err("Slot must be FULL_DAY, FN, or AN.".into());
    }
    let reason = input("Medical reason (at least 5 characters): ")?;
    if reason.chars().count() < 5 {
        return Err("Medical leave reason must be at least 5 characters.".into());
    }
    let departure = prompt_datetime("Intended departure date and time", true)?;
    let certificate = input("Medical certificate file path (PDF or image): ")?;
    let path = expand_path(&certificate);
    if certificate.is_empty() || !path.is_file() {
        return Err("Select an existing medical certificate file.".into());
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !["pdf", "jpg", "jpeg", "png", "heic", "heif", "webp"].contains(&ext.as_str()) {
        return Err("Certificate must be a PDF or image (JPG, PNG, HEIC, HEIF, or WebP).".into());
    }
    let mut fields = HashMap::from([
        ("fromDate".into(), start),
        ("toDate".into(), end),
        ("slot".into(), slot),
        ("reason".into(), reason),
    ]);
    if let Some(d) = departure {
        fields.insert("intendedExitAt".into(), d);
    }
    Ok((fields, certificate))
}

pub(crate) fn run(command: AttendanceCommand) -> CliResult<()> {
    let (email, password) = credentials("attendance")?;
    let base = attendance_base_url()?;
    let mut client = Attendance::new(base.clone(), email, password)?;
    client.login()?;
    let result = (|| -> CliResult<()> {
        match command {
            AttendanceCommand::Profile => print_json(&client.get("/api/auth/me")?),
            AttendanceCommand::Terms => print_json(&client.get("/api/terms")?),
            AttendanceCommand::Dl { course_id, json } => {
                let summary = client.get("/api/students/me/attendance")?;
                let report = super::dl::calculate(summary, course_id.as_deref())?;
                if json {
                    print_json(&serde_json::json!({
                        "source": format!("{}/api/students/me/attendance", base.trim_end_matches('/')),
                        "fetchedAt": Utc::now().to_rfc3339(),
                        "thresholdPercent": 80,
                        "assumption": super::dl::ASSUMPTION,
                        "courses": report,
                    }));
                } else {
                    super::dl::print_report(&report);
                }
            }
            AttendanceCommand::Summary => {
                let data = client.get("/api/students/me/attendance")?;
                let mut overall = HashMap::new();
                for v in value_arr(&data, "overall") {
                    overall.insert(
                        value_string(&v, "status"),
                        v.get("count").and_then(Value::as_i64).unwrap_or(0),
                    );
                }
                println!(
                    "Overall: present {}, absent {}",
                    overall.get("PRESENT").unwrap_or(&0),
                    overall.get("ABSENT").unwrap_or(&0)
                );
                println!("Attendance by course");
                for c in value_arr(&data, "byCourse") {
                    println!(
                        "{}\t{}\t{}/{}\t{}%\tDL credited {}",
                        value_string(&c, "courseCode"),
                        value_string(&c, "courseName"),
                        c.get("present").and_then(Value::as_i64).unwrap_or(0),
                        c.get("total").and_then(Value::as_i64).unwrap_or(0),
                        c.get("percentage")
                            .map(Value::to_string)
                            .unwrap_or("0".into()),
                        c.get("dlCredited")
                            .map(Value::to_string)
                            .unwrap_or("0".into())
                    );
                }
                println!("Recent sessions");
                for s in value_arr(&data, "recent") {
                    let course = s.get("course").cloned().unwrap_or_default();
                    println!(
                        "{}\t{}-{}\t{}\t{}\t{}",
                        value_string(&s, "date")
                            .chars()
                            .take(10)
                            .collect::<String>(),
                        value_string(&s, "startTime"),
                        value_string(&s, "endTime"),
                        value_string(&course, "code"),
                        value_string(&s, "status"),
                        value_string(&course, "name")
                    );
                }
            }
            AttendanceCommand::Appeal {
                session_id,
                dry_run,
            } => {
                let summary = client.get("/api/students/me/attendance")?;
                let mut target = None;
                let mut target_course = Value::Null;
                for c in value_arr(&summary, "byCourse") {
                    let cid = c
                        .get("courseId")
                        .map(Value::to_string)
                        .unwrap_or_default()
                        .trim_matches('"')
                        .to_string();
                    let path = format!(
                        "/api/students/me/courses/{}/sessions",
                        url::form_urlencoded::byte_serialize(cid.as_bytes()).collect::<String>()
                    );
                    let detail = client.get(&path)?;
                    if let Some(s) = value_arr(&detail, "sessions")
                        .into_iter()
                        .find(|s| value_string(s, "sessionId") == session_id)
                    {
                        target = Some(s);
                        target_course = detail.get("course").cloned().unwrap_or(c);
                        break;
                    }
                }
                let target=target.ok_or("Session was not found in your current attendance records; appeals are limited to available current-term sessions.")?;
                let status = value_string(&target, "status");
                if status != "ABSENT" && status != "EXCUSED" {
                    return Err(format!("This session is marked {}; the portal only offers appeals for absent or excused sessions.",if status.is_empty(){"UNKNOWN"}else{&status}));
                }
                let code = target_course
                    .get("courseCode")
                    .or_else(|| target_course.get("code"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let name = target_course
                    .get("courseName")
                    .or_else(|| target_course.get("name"))
                    .and_then(Value::as_str)
                    .unwrap_or("");
                println!(
                    "Session: {} {}-{} | {code} {name}",
                    value_string(&target, "date")
                        .chars()
                        .take(10)
                        .collect::<String>(),
                    value_string(&target, "startTime"),
                    value_string(&target, "endTime")
                );
                println!("Current status: {status}\nSession ID: {session_id}");
                if dry_run {
                    println!("Dry run only: no appeal was sent.");
                    return Ok(());
                }
                if !io::stdin().is_terminal() {
                    return Err("Appeal submission requires an interactive terminal.".into());
                }
                let reason = input(
                    "Why should this attendance record be reviewed? (minimum 5 characters): ",
                )?;
                if reason.chars().count() < 5 {
                    return Err(
                        "The portal requires an appeal reason of at least 5 characters.".into(),
                    );
                }
                println!("Appeal reason: {reason}");
                if input(&format!("Type APPEAL {session_id} to send this appeal: "))?
                    != format!("APPEAL {session_id}")
                {
                    println!("Cancelled; no appeal was sent.");
                    return Ok(());
                }
                client.request_json(
                    "/api/students/attendance/disputes",
                    Some(&json!({"sessionId":session_id,"reason":reason})),
                    true,
                )?;
                println!("Appeal submitted to the attendance portal.");
            }
            AttendanceCommand::ApplyLeave { dry_run } => {
                if !io::stdin().is_terminal() {
                    return Err("Leave applications require an interactive terminal for private fields and final confirmation.".into());
                }
                let payload = collect_personal_leave()?;
                println!("Personal leave application preview");
                for (label, key) in [
                    ("From", "fromDate"),
                    ("To", "toDate"),
                    ("Departure", "intendedExitAt"),
                    ("Return", "intendedReturnAt"),
                    ("Reason", "reason"),
                    ("Destination", "destinationAddress"),
                    ("Contact", "contactNumber"),
                ] {
                    println!("{label}: {}", value_string(&payload, key));
                }
                if dry_run {
                    println!("Dry run only: no application was sent.");
                    return Ok(());
                }
                if input("Type APPLY LEAVE to send this personal leave application: ")?
                    != "APPLY LEAVE"
                {
                    println!("Cancelled; no leave application was sent.");
                    return Ok(());
                }
                let response =
                    client.request_json("/api/students/me/leaves", Some(&payload), true)?;
                print_app_result("Personal leave", &response);
            }
            AttendanceCommand::ApplyMedicalLeave { dry_run } => {
                if !io::stdin().is_terminal() {
                    return Err("Leave applications require an interactive terminal for private fields and final confirmation.".into());
                }
                let (fields, file) = collect_medical_leave()?;
                println!("Medical leave application preview");
                for (label, key) in [
                    ("From", "fromDate"),
                    ("To", "toDate"),
                    ("Slot", "slot"),
                    ("Reason", "reason"),
                    ("Intended departure", "intendedExitAt"),
                ] {
                    if let Some(v) = fields.get(key) {
                        println!("{label}: {v}");
                    }
                }
                println!(
                    "Certificate: {} ({} bytes)",
                    Path::new(&file)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("certificate"),
                    fs::metadata(expand_path(&file))
                        .map(|m| m.len())
                        .unwrap_or(0)
                );
                if dry_run {
                    println!(
                        "Dry run only: certificate was not uploaded and no application was sent."
                    );
                    return Ok(());
                }
                if input("Type APPLY MEDICAL LEAVE to upload the certificate and send this application: ")?!="APPLY MEDICAL LEAVE"{println!("Cancelled; the certificate was not uploaded and no application was sent.");return Ok(());}
                let response =
                    client.multipart("/api/students/me/medical-leaves", &fields, &file)?;
                print_app_result("Medical leave", &response);
            }
            AttendanceCommand::Sessions { course_id } => {
                attendance_sessions(&client, course_id.as_deref().unwrap_or("all"), false)?
            }
            AttendanceCommand::Report { course_id } => {
                attendance_sessions(&client, course_id.as_deref().unwrap_or("all"), true)?
            }
        }
        Ok(())
    })();
    client.logout();
    result
}
fn attendance_sessions(client: &Attendance, requested: &str, report: bool) -> CliResult<()> {
    let summary = client.get("/api/students/me/attendance")?;
    let mut courses = value_arr(&summary, "byCourse");
    if requested != "all" {
        courses.retain(|c| {
            c.get("courseId")
                .map(|v| v.to_string().trim_matches('"') == requested)
                .unwrap_or(false)
                || value_string(c, "courseCode") == requested
        });
        if courses.is_empty() {
            return Err(format!(
                "Attendance course {requested} was not in the current summary."
            ));
        }
    }
    for course in courses {
        let id = course
            .get("courseId")
            .map(Value::to_string)
            .unwrap_or_default()
            .trim_matches('"')
            .to_string();
        let path = format!(
            "/api/students/me/courses/{}/sessions",
            url::form_urlencoded::byte_serialize(id.as_bytes()).collect::<String>()
        );
        let detail = client.get(&path)?;
        let metadata = detail
            .get("course")
            .cloned()
            .unwrap_or_else(|| course.clone());
        let code = metadata
            .get("courseCode")
            .or_else(|| metadata.get("code"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let name = metadata
            .get("courseName")
            .or_else(|| metadata.get("name"))
            .and_then(Value::as_str)
            .unwrap_or("");
        println!(
            "\n{code} — {name} | {}/{} ({}%)",
            detail
                .get("present")
                .or_else(|| course.get("present"))
                .map(Value::to_string)
                .unwrap_or("0".into()),
            detail
                .get("total")
                .or_else(|| course.get("total"))
                .map(Value::to_string)
                .unwrap_or("0".into()),
            detail
                .get("percentage")
                .or_else(|| course.get("percentage"))
                .map(Value::to_string)
                .unwrap_or("0".into())
        );
        if report {
            let faculty = value_arr(&detail, "faculty");
            if !faculty.is_empty() {
                println!(
                    "Faculty: {}",
                    faculty
                        .iter()
                        .filter_map(|f| f.get("name").and_then(Value::as_str))
                        .collect::<Vec<_>>()
                        .join(", ")
                );
            }
        }
        for s in value_arr(&detail, "sessions") {
            println!(
                "{}\t{}-{}\t{}\t{}\t{}\t{}",
                value_string(&s, "date")
                    .chars()
                    .take(10)
                    .collect::<String>(),
                value_string(&s, "startTime"),
                value_string(&s, "endTime"),
                value_string(&s, "status"),
                value_string(&s, "section"),
                if value_string(&s, "topic").is_empty() {
                    value_string(&s, "heldReason")
                } else {
                    value_string(&s, "topic")
                },
                value_string(&s, "sessionId")
            );
        }
    }
    Ok(())
}
