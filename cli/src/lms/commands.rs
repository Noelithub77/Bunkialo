use super::Moodle;
use crate::cli::{LmsCommand, SubmitArgs};
use crate::common::*;
use chrono::{DateTime, Local, NaiveDateTime, TimeZone, Utc};
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::io::{self, IsTerminal};
use std::path::{Path, PathBuf};
use url::Url;

pub(crate) fn run(command: LmsCommand) -> CliResult<()> {
    let (username, password) = credentials("lms")?;
    let base = lms_base_url()?;
    let client = Moodle::new(base, username, password)?;
    let dashboard = client.login()?;
    match command {
        LmsCommand::Courses => print_courses(&client.courses(Some(&dashboard))),
        LmsCommand::Deadlines { days, limit } => {
            if days < 1 || limit < 1 || limit > 50 {
                return Err("--days must be positive and --limit must be between 1 and 50.".into());
            }
            let events = client.events(days, limit)?;
            if events.is_empty() {
                println!("No upcoming or recent overdue timeline events were returned.");
            }
            for (event, past) in events {
                let due = event
                    .get("timesort")
                    .and_then(Value::as_i64)
                    .map(|t| {
                        DateTime::<Utc>::from_timestamp(t, 0)
                            .map(|d| d.with_timezone(&Local).format("%Y-%m-%d %H:%M").to_string())
                            .unwrap_or("date unavailable".into())
                    })
                    .unwrap_or("date unavailable".into());
                let course = event
                    .pointer("/course/fullname")
                    .and_then(Value::as_str)
                    .unwrap_or("");
                let url = value_string(&event, "url");
                let safe = if url.is_empty() {
                    String::new()
                } else {
                    safe_url(&client.base, &url)?
                };
                println!(
                    "{}\t{}\t{}\t{}\t{}",
                    if past { "OVERDUE" } else { "UPCOMING" },
                    due,
                    compact(course),
                    compact(&value_string(&event, "name")),
                    safe
                );
            }
        }
        LmsCommand::Recent => {
            let now = Utc::now().timestamp();
            let window = 30 * 86_400;
            let mut timeline = Vec::new();
            let mut calendar_assignments = std::collections::HashMap::new();
            let mut calendar_quizzes = std::collections::HashMap::new();
            for (event, _) in client.events(30, 50)? {
                let due = event
                    .get("timesort")
                    .and_then(Value::as_i64)
                    .unwrap_or_default();
                if due < now - window || due > now + window {
                    continue;
                }
                let raw_url = value_string(&event, "url");
                let url = safe_url(&client.base, &raw_url)?;
                let parsed = Url::parse(&url).map_err(|_| "Invalid Moodle event URL.")?;
                let activity_id = parsed
                    .query_pairs()
                    .find(|(key, _)| key == "id")
                    .map(|(_, value)| value.to_string())
                    .unwrap_or_default();
                if parsed.path().contains("/mod/assign/") {
                    calendar_assignments.insert(activity_id, due);
                } else if parsed.path().contains("/mod/quiz/") {
                    calendar_quizzes.insert(activity_id, due);
                }
            }
            let mut seen = HashSet::new();
            for course in client.courses(Some(&dashboard)) {
                let course_id = value_string(&course, "id");
                let course_name = value_string(&course, "name");
                let (_, activities) = client.activities(&course_id)?;
                for activity in activities.into_iter().filter(|item| {
                    ["assign", "quiz"].contains(&value_string(item, "type").as_str())
                }) {
                    let activity_id = value_string(&activity, "id");
                    let kind = value_string(&activity, "type");
                    if !seen.insert((kind.clone(), activity_id.clone())) {
                        continue;
                    }
                    if kind == "assign" {
                        let details = client.assignment_details(&activity_id)?;
                        let due = parse_moodle_due(&value_string(&details, "due"))
                            .or_else(|| calendar_assignments.get(&activity_id).copied());
                        let Some(due) = due else {
                            continue;
                        };
                        if due < now - window || due > now + window {
                            continue;
                        }
                        let status = details
                            .pointer("/status/Submission status")
                            .and_then(Value::as_str)
                            .unwrap_or("not shown");
                        timeline.push((
                            due,
                            "assignment".to_string(),
                            course_name.clone(),
                            value_string(&details, "title"),
                            status.to_string(),
                            value_string(&activity, "url"),
                        ));
                    } else {
                        let details = client.quiz_details(&activity_id)?;
                        let due = parse_moodle_due(&value_string(&details, "closed"))
                            .or_else(|| calendar_quizzes.get(&activity_id).copied())
                            .or_else(|| parse_moodle_due(&value_string(&details, "opened")));
                        let Some(due) = due else {
                            continue;
                        };
                        if due < now - window || due > now + window {
                            continue;
                        }
                        timeline.push((
                            due,
                            "quiz".to_string(),
                            course_name.clone(),
                            value_string(&details, "title"),
                            value_string(&details, "attempt_status"),
                            value_string(&activity, "url"),
                        ));
                    }
                }
            }
            timeline.sort_by_key(|entry| entry.0);
            for (due, kind, course, title, status, url) in &timeline {
                let local = DateTime::<Utc>::from_timestamp(*due, 0)
                    .map(|d| d.with_timezone(&Local).format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| "date unavailable".into());
                println!(
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}",
                    if *due < now { "PAST" } else { "UPCOMING" },
                    local,
                    kind,
                    compact(course),
                    compact(title),
                    status,
                    url
                );
            }
            if timeline.is_empty() {
                println!("No assignments or quizzes due in the past or next 30 days.");
            }
        }
        LmsCommand::Course { course_id } => {
            let (title, items) = client.activities(&course_id)?;
            println!("{title} (course {course_id})");
            for item in items {
                print_activity(&item);
            }
        }
        LmsCommand::Content { course } => {
            let mut courses = client.courses(Some(&dashboard));
            if let Some(id) = course {
                courses.retain(|v| value_string(v, "id") == id);
                if courses.is_empty() {
                    return Err(format!("Course {id} was not in the enrolled course list."));
                }
            }
            for c in courses {
                let id = value_string(&c, "id");
                let (title, sections) = client.course_sections(&id)?;
                println!("\n{title} (course {id})");
                for section in sections {
                    println!("  [{}]", value_string(&section, "name"));
                    let summary = value_string(&section, "summary");
                    if !summary.is_empty() {
                        println!("    {summary}");
                    }
                    for activity in value_arr(&section, "items") {
                        let is_assign = value_string(&activity, "type") == "assign";
                        let data = if is_assign {
                            Some(client.assignment_details(&value_string(&activity, "id"))?)
                        } else {
                            None
                        };
                        let status = data
                            .as_ref()
                            .and_then(|d| d.pointer("/status/Submission status"))
                            .and_then(Value::as_str)
                            .unwrap_or("Submission status unavailable");
                        println!(
                            "    {}\t{}\t{}{}\t{}",
                            value_string(&activity, "type"),
                            value_string(&activity, "id"),
                            value_string(&activity, "name"),
                            if is_assign {
                                format!(" — {status}")
                            } else {
                                String::new()
                            },
                            value_string(&activity, "url")
                        );
                        for (label, key) in [
                            ("Description", "description"),
                            ("Availability", "availability"),
                        ] {
                            let value = value_string(&activity, key);
                            if !value.is_empty() {
                                println!("      {label}: {value}");
                            }
                        }
                        if let Some(d) = data {
                            println!(
                                "      Description: {}",
                                if value_string(&d, "description").is_empty() {
                                    "not shown".into()
                                } else {
                                    value_string(&d, "description")
                                }
                            );
                            for (item, url) in pairs(&d, "submitted") {
                                println!("      Submitted file: {item} ({url})");
                            }
                        }
                    }
                }
            }
        }
        LmsCommand::Assignments { course } => {
            let mut courses = client.courses(Some(&dashboard));
            if let Some(id) = course {
                courses.retain(|v| value_string(v, "id") == id);
                if courses.is_empty() {
                    return Err(format!("Course {id} was not in the enrolled course list."));
                }
            }
            for c in courses {
                let (_, activities) = client.activities(&value_string(&c, "id"))?;
                for a in activities
                    .into_iter()
                    .filter(|a| value_string(a, "type") == "assign")
                {
                    let d = client.assignment_details(&value_string(&a, "id"))?;
                    print_assignment(
                        &d,
                        &value_string(&a, "url"),
                        &value_string(&c, "name"),
                        &value_string(&a, "id"),
                    );
                }
            }
        }
        LmsCommand::Resources { course_id } => {
            let (title, sections) = client.course_sections(&course_id)?;
            println!("Resources — {title}");
            for section in sections {
                println!("[{}]", value_string(&section, "name"));
                for a in value_arr(&section, "items") {
                    if ["resource", "folder", "url", "page", "book", "file"]
                        .contains(&value_string(&a, "type").as_str())
                    {
                        print_activity(&a);
                        if value_string(&a, "type") == "folder" {
                            for file in client.folder_files(&value_string(&a, "id"))? {
                                println!(
                                    "  file\t{}\t{}",
                                    value_string(&file, "name"),
                                    value_string(&file, "url")
                                );
                            }
                        }
                    }
                }
            }
        }
        LmsCommand::Page { url } => {
            let data = client.page_content(&url)?;
            println!("{}", value_string(&data, "title"));
            println!("{}", value_string(&data, "text"));
            for item in value_arr(&data, "links") {
                println!(
                    "Link: {} ({})",
                    value_string(&item, "name"),
                    value_string(&item, "url")
                );
            }
        }
        LmsCommand::Download { url, output, force } => {
            let output = output.as_deref().map(Path::new);
            let path = client.download_url(&url, output, None, force)?;
            println!("Downloaded: {}", path.display());
        }
        LmsCommand::DownloadAssignment {
            activity_id,
            output_dir,
            force,
        } => {
            let directory = output_dir
                .map(|path| expand_path(&path))
                .unwrap_or_else(|| PathBuf::from(format!("downloads/assignment-{activity_id}")));
            let paths = client.download_assignment_materials(&activity_id, &directory, force)?;
            if paths.is_empty() {
                println!("No downloadable assignment images or attachments were found.");
            } else {
                for path in paths {
                    println!("Downloaded: {}", path.display());
                }
            }
        }
        LmsCommand::DownloadCourse {
            course_id,
            output_dir,
            force,
        } => {
            let directory = output_dir
                .map(|path| expand_path(&path))
                .unwrap_or_else(|| PathBuf::from(format!("downloads/course-{course_id}")));
            let paths = client.download_course_materials(&course_id, &directory, force)?;
            if paths.is_empty() {
                println!("No downloadable files were found in this course.");
            } else {
                for path in paths {
                    println!("Downloaded: {}", path.display());
                }
            }
        }
        LmsCommand::Assignment { activity_id } => {
            let d = client.assignment_details(&activity_id)?;
            print_assignment(&d, "", "", &activity_id);
        }
        LmsCommand::Quiz { activity_id } => {
            numeric_id(&activity_id)?;
            let data = client.quiz_details(&activity_id)?;
            println!(
                "{} (quiz activity {})",
                value_string(&data, "title"),
                activity_id
            );
            for (label, key) in [
                ("Opened", "opened"),
                ("Closed", "closed"),
                ("Attempt status", "attempt_status"),
            ] {
                let value = value_string(&data, key);
                if !value.is_empty() {
                    println!("{label}: {value}");
                }
            }
        }
        LmsCommand::Forum { activity_id } => {
            numeric_id(&activity_id)?;
            let discussions = client.forum_discussions(&activity_id)?;
            if discussions.is_empty() {
                println!("No discussions were listed in forum {activity_id}.");
            }
            for discussion in discussions {
                println!(
                    "{}\t{}\t{}",
                    value_string(&discussion, "id"),
                    value_string(&discussion, "title"),
                    value_string(&discussion, "url")
                );
            }
        }
        LmsCommand::Discussion { discussion_id } => {
            numeric_id(&discussion_id)?;
            let posts = client.forum_posts(&discussion_id)?;
            if posts.is_empty() {
                println!("No posts were listed in discussion {discussion_id}.");
            }
            for post in posts {
                println!(
                    "\n{} — {}",
                    value_string(&post, "title"),
                    value_string(&post, "author")
                );
                println!(
                    "Post {} | {}",
                    value_string(&post, "id"),
                    value_string(&post, "date")
                );
                println!("{}", value_string(&post, "body"));
                for item in value_arr(&post, "attachments") {
                    println!(
                        "Attachment: {} ({})",
                        value_string(&item, "name"),
                        value_string(&item, "url")
                    );
                }
            }
        }
        LmsCommand::Submit(args) => submit_assignment(&client, args)?,
        LmsCommand::Unsubmit {
            activity_id,
            dry_run,
        } => unsubmit_assignment(&client, &activity_id, dry_run)?,
    }
    Ok(())
}

fn print_courses(courses: &[Value]) {
    if courses.is_empty() {
        println!("No in-progress courses were returned.");
        return;
    }
    for c in courses {
        println!(
            "{}\t{}",
            value_string(c, "id"),
            compact(&value_string(c, "name"))
        );
    }
}
fn print_activity(a: &Value) {
    println!(
        "{}\t{}\t{}\t{}",
        value_string(a, "type"),
        value_string(a, "id"),
        value_string(a, "name"),
        value_string(a, "url")
    );
    for (label, key) in [
        ("Description", "description"),
        ("Availability", "availability"),
    ] {
        let value = value_string(a, key);
        if !value.is_empty() {
            println!("  {label}: {value}");
        }
    }
}
fn pairs(v: &Value, key: &str) -> Vec<(String, String)> {
    value_arr(v, key)
        .iter()
        .filter_map(|a| {
            let arr = a.as_array()?;
            Some((
                arr.first()?.as_str()?.to_string(),
                arr.get(1)?.as_str()?.to_string(),
            ))
        })
        .collect()
}
fn numeric_id(id: &str) -> CliResult<()> {
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err("Moodle activity or discussion ID must be numeric.".into());
    }
    Ok(())
}
fn parse_moodle_due(value: &str) -> Option<i64> {
    let formats = [
        "%A, %-d %B %Y, %-I:%M %p",
        "%A, %d %B %Y, %I:%M %p",
        "%-d %B %Y, %-I:%M %p",
        "%d %B %Y, %I:%M %p",
        "%Y-%m-%d %H:%M",
    ];
    formats.iter().find_map(|format| {
        let date = NaiveDateTime::parse_from_str(value, format).ok()?;
        Local
            .from_local_datetime(&date)
            .single()
            .map(|local| local.timestamp())
    })
}
fn print_assignment(d: &Value, url: &str, course: &str, activity_id: &str) {
    let title = value_string(d, "title");
    if !course.is_empty() {
        println!("\n{course} — {title} (activity {activity_id})");
    } else {
        println!("{title} (activity {activity_id})");
    }
    if !url.is_empty() {
        println!("URL: {url}");
    }
    println!(
        "Due: {}",
        if value_string(d, "due").is_empty() {
            "not shown".into()
        } else {
            value_string(d, "due")
        }
    );
    if let Some(dates) = d.get("dates").and_then(Value::as_object) {
        for (label, value) in dates {
            if label.eq_ignore_ascii_case("due") {
                continue;
            }
            println!("{label}: {}", value.as_str().unwrap_or(""));
        }
    }
    println!(
        "Description: {}",
        if value_string(d, "description").is_empty() {
            "not shown".into()
        } else {
            value_string(d, "description")
        }
    );
    for (label, u) in pairs(d, "images") {
        println!("Assignment image: {label} ({u})");
    }
    for (label, u) in pairs(d, "resources") {
        println!("Assignment attachment/link: {label} ({u})");
    }
    println!("Submission details:");
    if let Some(status) = d.get("status").and_then(Value::as_object) {
        if status.is_empty() {
            println!("  Submission status was not shown on the page.");
        }
        for (k, v) in status {
            println!("  {k}: {}", v.as_str().unwrap_or(""));
        }
    }
    for (n, u) in pairs(d, "submitted") {
        println!("  Submitted file: {n} ({u})");
    }
}

fn submit_assignment(client: &Moodle, args: SubmitArgs) -> CliResult<()> {
    if !Regex::new(r"^\d+$").unwrap().is_match(&args.activity_id) {
        return Err("Moodle assignment activity ID must be numeric.".into());
    }
    let details = client.assignment_details(&args.activity_id)?;
    let session = client.assignment_edit_session(&args.activity_id)?;
    let accepted_values = value_arr(&session, "accepted_types");
    let accepted = accepted_values
        .iter()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();
    println!(
        "Assignment: {} (activity {})",
        value_string(&details, "title"),
        args.activity_id
    );
    println!(
        "Current status: {}",
        details
            .pointer("/status/Submission status")
            .and_then(Value::as_str)
            .unwrap_or("not shown")
    );
    let can_file = !value_string(&session, "file_item_id").is_empty()
        && !value_string(&session, "repository_id").is_empty();
    println!(
        "File submission: {}",
        if can_file { "available" } else { "unavailable" }
    );
    println!(
        "Accepted file types: {}",
        if accepted.is_empty() {
            "any file type shown as permitted by Moodle".into()
        } else {
            accepted.join(", ")
        }
    );
    println!(
        "Maximum files: {}",
        session
            .get("max_files")
            .filter(|v| !v.is_null())
            .map(Value::to_string)
            .unwrap_or("not specified".into())
    );
    println!(
        "Maximum file size: {} bytes",
        session
            .get("max_bytes")
            .filter(|v| !v.is_null())
            .map(Value::to_string)
            .unwrap_or("not specified".into())
    );
    let online = !value_string(&session, "online_field").is_empty();
    println!(
        "Online text: {}",
        if online { "available" } else { "unavailable" }
    );
    if args.dry_run {
        println!("Dry run only: no files uploaded and no submission saved.");
        return Ok(());
    }
    if args.files.is_empty() && args.text.is_none() && args.text_file.is_none() {
        return Err(
            "Choose at least one --file, --text, or --text-file input (or use --dry-run).".into(),
        );
    }
    if !args.files.is_empty() && !can_file {
        return Err("This assignment does not accept file submissions.".into());
    }
    if (args.text.is_some() || args.text_file.is_some()) && !online {
        return Err("This assignment does not accept online-text submissions.".into());
    }
    let mut text = args.text.clone();
    if let Some(path) = &args.text_file {
        text = Some(
            fs::read_to_string(expand_path(path))
                .map_err(|_| "Could not read online-text file (expected UTF-8).".to_string())?,
        );
    }
    let current = value_arr(&details, "submitted").len();
    if let Some(max) = session.get("max_files").and_then(Value::as_i64) {
        if max >= 0 && current + args.files.len() as usize > max as usize {
            return Err(format!(
                "Selected files plus the current submission exceed Moodle's {max}-file limit."
            ));
        }
    }
    if !args.files.is_empty() {
        println!("Selected files:");
        for path in &args.files {
            let p = expand_path(path);
            let meta = fs::metadata(&p).map_err(|_| format!("File not found: {path}"))?;
            println!(
                "  {} ({} bytes)",
                p.file_name().and_then(|s| s.to_str()).unwrap_or("file"),
                meta.len()
            );
        }
        if !io::stdin().is_terminal() {
            return Err("Submission requires an interactive terminal for the upload and final-save confirmations.".into());
        }
        if input(&format!(
            "Type UPLOAD {} to send these file(s) to Moodle's assignment draft area: ",
            args.activity_id
        ))? != format!("UPLOAD {}", args.activity_id)
        {
            println!("Cancelled before file upload; nothing was sent.");
            return Ok(());
        }
    }
    let mut item = value_string(&session, "file_item_id");
    for path in &args.files {
        let mut next = session.clone();
        next["file_item_id"] = json!(item);
        let (id, name) = client.upload_assignment_draft(&next, path)?;
        item = id;
        println!("Uploaded to Moodle draft area: {name}");
    }
    let html = if let Some(text) = text {
        Some(
            text.split("\n\n")
                .map(|p| format!("<p>{}</p>", html_escape::encode_text(p)))
                .collect::<Vec<_>>()
                .join(""),
        )
    } else if online {
        Some(value_string(&session, "online_value"))
    } else {
        None
    };
    println!("Moodle will first save this content in the assignment draft area.");
    if !io::stdin().is_terminal() {
        return Err("Saving an assignment draft requires an interactive terminal.".into());
    }
    if input(&format!(
        "Type SAVE {} to save this assignment draft: ",
        args.activity_id
    ))? != format!("SAVE {}", args.activity_id)
    {
        println!("Cancelled before saving the assignment draft. Any uploaded file remains in Moodle's draft area.");
        return Ok(());
    }
    client.save_assignment_submission(&session, &item, html.as_deref())?;
    let mut verified = client.assignment_details(&args.activity_id)?;
    println!("Moodle saved the assignment draft. Current portal status:");
    if let Some(status) = verified.get("status").and_then(Value::as_object) {
        for (k, v) in status {
            println!("  {k}: {}", v.as_str().unwrap_or(""));
        }
    }
    for (n, u) in pairs(&verified, "submitted") {
        println!("  Draft file: {n} ({u})");
    }
    let status = verified
        .pointer("/status/Submission status")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_lowercase();
    if status.contains("submitted for grading") {
        println!("Moodle reports this assignment is submitted for grading.");
        return Ok(());
    }
    let final_form = client.submit_for_grading_form(&args.activity_id)?;
    println!("Moodle requires a separate final submission for grading.");
    if !io::stdin().is_terminal() {
        return Err("Final submission for grading requires an interactive terminal; the saved work remains a draft.".into());
    }
    if input(&format!(
        "Type SUBMIT {} to submit this saved draft for grading: ",
        args.activity_id
    ))? != format!("SUBMIT {}", args.activity_id)
    {
        println!("Cancelled before final submission. The saved work remains a Moodle draft.");
        return Ok(());
    }
    client.post_submit_for_grading(&final_form)?;
    verified = client.assignment_details(&args.activity_id)?;
    let final_status = verified
        .pointer("/status/Submission status")
        .and_then(Value::as_str)
        .unwrap_or("not shown");
    if !final_status
        .to_lowercase()
        .contains("submitted for grading")
    {
        return Err(format!(
            "Moodle did not confirm submission for grading; current status is: {final_status}"
        ));
    }
    println!("Moodle confirmed submission for grading: {final_status}");
    for (n, u) in pairs(&verified, "submitted") {
        println!("  Submitted file: {n} ({u})");
    }
    Ok(())
}

fn unsubmit_assignment(client: &Moodle, activity_id: &str, dry_run: bool) -> CliResult<()> {
    if !Regex::new(r"^\d+$").unwrap().is_match(activity_id) {
        return Err("Moodle assignment activity ID must be numeric.".into());
    }
    let details = client.assignment_details(activity_id)?;
    let status = details
        .pointer("/status/Submission status")
        .and_then(Value::as_str)
        .unwrap_or("not shown");
    println!(
        "Assignment: {} (activity {})",
        value_string(&details, "title"),
        activity_id
    );
    println!("Current status: {status}");
    if !status.to_lowercase().contains("submitted for grading") {
        return Err(
            "This assignment is not currently submitted for grading; nothing was changed.".into(),
        );
    }
    let action_url = client
        .revert_to_draft_url(activity_id)?
        .ok_or("Moodle does not expose a revert-to-draft action for this submission.")?;
    println!("Action: revert submitted work to draft; uploaded files are retained.");
    if dry_run {
        println!("Dry run only: no Moodle action was sent.");
        return Ok(());
    }
    if !io::stdin().is_terminal() {
        return Err("Unsubmitting requires an interactive terminal for confirmation.".into());
    }
    if input(&format!(
        "Type UNSUBMIT {activity_id} to revert this submission to draft: "
    ))? != format!("UNSUBMIT {activity_id}")
    {
        println!("Cancelled; the submitted assignment was not changed.");
        return Ok(());
    }
    client.perform_revert_to_draft(&action_url)?;
    let verified = client.assignment_details(activity_id)?;
    let new_status = verified
        .pointer("/status/Submission status")
        .and_then(Value::as_str)
        .unwrap_or("not shown");
    if !new_status.to_lowercase().contains("draft") {
        return Err(format!(
            "Moodle did not confirm a draft status after the revert; current status is: {new_status}"
        ));
    }
    println!("Moodle confirmed the assignment is back in draft status.");
    for (name, url) in pairs(&verified, "submitted") {
        println!("Draft file: {name} ({url})");
    }
    Ok(())
}
