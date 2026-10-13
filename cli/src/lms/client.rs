use crate::common::*;
use chrono::Utc;
use regex::Regex;
use reqwest::blocking::Client;
use reqwest::header::{ACCEPT, CONTENT_DISPOSITION, CONTENT_TYPE};
use scraper::ElementRef;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use url::Url;

pub(crate) struct Moodle {
    pub(super) base: String,
    username: String,
    password: String,
    client: Client,
}
impl Moodle {
    pub(crate) fn new(base: String, username: String, password: String) -> CliResult<Self> {
        Ok(Self {
            base: base.trim_end_matches('/').into(),
            username,
            password,
            client: http_client_for_host(&base)?,
        })
    }
    pub(super) fn get(&self, path: &str) -> CliResult<String> {
        let url = safe_url(&self.base, path)?;
        let response = self
            .client
            .get(url)
            .header(ACCEPT, "text/html,application/xhtml+xml")
            .send()
            .map_err(|e| format!("Could not reach the LMS ({}).", e))?;
        response_text(response, "LMS")
    }
    pub(crate) fn login(&self) -> CliResult<String> {
        let source = self.get("/login/index.php")?;
        let doc = page(&source);
        let mut fields = HashMap::new();
        for input in doc.select(&sel("input[type=hidden][name]")) {
            fields.insert(
                attr(input, "name").to_string(),
                attr(input, "value").to_string(),
            );
        }
        fields.insert("username".into(), self.username.clone());
        fields.insert("password".into(), self.password.clone());
        let url = safe_url(&self.base, "/login/index.php")?;
        let response = self
            .client
            .post(url)
            .header(ACCEPT, "text/html")
            .form(&fields)
            .send()
            .map_err(|e| format!("LMS login failed ({}).", e))?;
        if !response.status().is_success() {
            return Err(format!(
                "LMS login was rejected (HTTP {}).",
                response.status().as_u16()
            ));
        }
        let dashboard = self.get("/my/")?;
        if Regex::new(r#"(?i)name=["']logintoken["']|id=["']login["']|loginerrormessage"#)
            .unwrap()
            .is_match(&dashboard)
        {
            return Err("LMS rejected the credentials or returned to its login page.".into());
        }
        Ok(dashboard)
    }
    pub(super) fn sesskey(&self, dashboard: Option<&str>) -> CliResult<String> {
        let owned;
        let source = match dashboard {
            Some(s) => s,
            None => {
                owned = self.get("/my/")?;
                &owned
            }
        };
        let re = Regex::new(r#"["']sesskey["']\s*:\s*["']([^"']+)"#).unwrap();
        if let Some(c) = re.captures(source) {
            return Ok(c[1].into());
        }
        let doc = page(source);
        if let Some(input) = doc.select(&sel("input[name=sesskey]")).next() {
            return Ok(attr(input, "value").to_string());
        }
        Err("Could not find the LMS session key; sign in again or use the visible site.".into())
    }
    pub(super) fn ajax(
        &self,
        method: &str,
        args: Value,
        dashboard: Option<&str>,
    ) -> CliResult<Value> {
        let sesskey = self.sesskey(dashboard)?;
        let mut url =
            Url::parse(&format!("{}/", self.base)).map_err(|_| "Invalid LMS URL.".to_string())?;
        url.set_path("/lib/ajax/service.php");
        url.query_pairs_mut()
            .append_pair("sesskey", &sesskey)
            .append_pair("info", method);
        let body = json!([{"index":0,"methodname":method,"args":args}]);
        let response = self
            .client
            .post(url)
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "application/json")
            .json(&body)
            .send()
            .map_err(|e| format!("Could not reach the LMS ({}).", e))?;
        let value: Value = serde_json::from_str(&response_text(response, "LMS data")?)
            .map_err(|_| "The LMS returned an unexpected response.".to_string())?;
        let item = value
            .as_array()
            .and_then(|a| a.first())
            .ok_or("The LMS returned an unexpected response.")?;
        if item.get("error").and_then(Value::as_bool).unwrap_or(false) {
            return Err("The LMS rejected this read request.".into());
        }
        Ok(item.get("data").cloned().unwrap_or_else(|| json!({})))
    }
    pub(super) fn courses(&self, dashboard: Option<&str>) -> Vec<Value> {
        let owned;
        let dashboard = match dashboard {
            Some(s) => s,
            None => {
                owned = self.get("/my/").unwrap_or_default();
                &owned
            }
        };
        if let Ok(data) = self.ajax(
            "core_course_get_enrolled_courses_by_timeline_classification",
            json!({"offset":0,"limit":0,"classification":"inprogress","sort":"fullname"}),
            Some(dashboard),
        ) {
            let courses = value_arr(&data, "courses");
            if !courses.is_empty() {
                return courses.into_iter().filter_map(|c| {
                let id = c.get("id")?.to_string().trim_matches('"').to_string();
                Some(json!({"id":id,"name":c.get("fullname").or(c.get("shortname")).and_then(Value::as_str).unwrap_or("Course"),"url":c.get("viewurl").and_then(Value::as_str).unwrap_or("")}))
            }).collect();
            }
        }
        let doc = page(dashboard);
        let re = Regex::new(r"/course/view\.php\?id=(\d+)").unwrap();
        let mut seen = HashSet::new();
        let mut out = Vec::new();
        for a in doc.select(&sel("a[href]")) {
            let href = attr(a, "href");
            if let Some(c) = re.captures(href) {
                let id = c[1].to_string();
                if seen.insert(id.clone()) {
                    let name = text_of(a);
                    if !name.is_empty() {
                        if let Ok(url) = safe_url(&self.base, href) {
                            out.push(json!({"id":id,"name":name,"url":url}));
                        }
                    }
                }
            }
        }
        out
    }
    pub(super) fn events(&self, days: i64, limit: i64) -> CliResult<Vec<(Value, bool)>> {
        let now = Utc::now().timestamp();
        let upcoming = self.ajax(
            "core_calendar_get_action_events_by_timesort",
            json!({"limitnum":limit,"timesortfrom":now,"limittononsuspendedevents":true}),
            None,
        )?;
        let past=self.ajax("core_calendar_get_action_events_by_timesort",json!({"limitnum":limit,"timesortfrom":now-days.min(30)*86400,"timesortto":now,"limittononsuspendedevents":true}),None)?;
        Ok(value_arr(&upcoming, "events")
            .into_iter()
            .filter(|v| {
                v.get("timesort")
                    .and_then(Value::as_i64)
                    .is_some_and(|time| time <= now + days * 86400)
            })
            .map(|v| (v, false))
            .chain(value_arr(&past, "events").into_iter().map(|v| (v, true)))
            .collect())
    }
    pub(super) fn activities(&self, course_id: &str) -> CliResult<(String, Vec<Value>)> {
        let doc = page(&self.get(&format!("/course/view.php?id={course_id}"))?);
        let title = doc
            .select(&sel("h1"))
            .map(text_of)
            .find(|s| !s.is_empty())
            .unwrap_or_else(|| format!("Course {course_id}"));
        let re = Regex::new(r"/mod/([a-z]+)/view\.php\?id=(\d+)").unwrap();
        let mut seen = HashSet::new();
        let mut items = Vec::new();
        for a in doc.select(&sel("a[href]")) {
            let href = attr(a, "href");
            if let Some(c) = re.captures(href) {
                let kind = c[1].to_string();
                let id = c[2].to_string();
                if seen.insert((kind.clone(), id.clone())) {
                    items.push(json!({"id":id,"type":kind,"name":if text_of(a).is_empty(){format!("{} {}",&c[1],&c[2])}else{text_of(a)},"url":safe_url(&self.base,href)?}));
                }
            }
        }
        Ok((title, items))
    }
    pub(super) fn course_sections(&self, course_id: &str) -> CliResult<(String, Vec<Value>)> {
        let doc = page(&self.get(&format!("/course/view.php?id={course_id}"))?);
        let title = doc
            .select(&sel("h1"))
            .map(text_of)
            .find(|s| !s.is_empty())
            .unwrap_or_else(|| format!("Course {course_id}"));
        let re = Regex::new(r"/mod/([a-z]+)/view\.php\?id=(\d+)").unwrap();
        let mut sections = Vec::new();
        for section in doc.select(&sel("li.section, li.course-section")) {
            let heading = section
                .select(&sel(".sectionname, h2, h3"))
                .map(text_of)
                .find(|s| !s.is_empty())
                .unwrap_or("Section".into());
            let summary = section
                .select(&sel(".summary, .contentwithoutlink"))
                .next()
                .map(text_of)
                .unwrap_or_default();
            let mut seen = HashSet::new();
            let mut items = Vec::new();
            for a in section.select(&sel("a[href]")) {
                let href = attr(a, "href");
                if let Some(c) = re.captures(href) {
                    let kind = c[1].to_string();
                    let id = c[2].to_string();
                    if seen.insert((kind.clone(), id.clone())) {
                        let name = text_of(a);
                        let activity = a
                            .ancestors()
                            .filter_map(ElementRef::wrap)
                            .find(|n| n.value().name() == "li" && has_class(*n, "activity"));
                        let description = activity
                            .and_then(|n| n.select(&sel(".description, .contentafterlink")).next())
                            .map(text_of)
                            .unwrap_or_default();
                        let availability = activity
                            .and_then(|n| n.select(&sel(".availabilityinfo")).next())
                            .map(text_of)
                            .unwrap_or_default();
                        items.push(json!({"id":id,"type":kind,"name":if name.is_empty(){format!("{kind} {id}")}else{name},"url":safe_url(&self.base,href)?,"description":description,"availability":availability}));
                    }
                }
            }
            sections.push(json!({"name":heading,"summary":summary,"items":items}));
        }
        if sections.is_empty() {
            let (_, items) = self.activities(course_id)?;
            sections.push(json!({"name":"Course activities","summary":"","items":items}));
        }
        Ok((title, sections))
    }
    pub(super) fn assignment_details(&self, activity_id: &str) -> CliResult<Value> {
        let doc = page(&self.get(&format!("/mod/assign/view.php?id={activity_id}"))?);
        let title = doc
            .select(&sel("h1"))
            .map(text_of)
            .find(|s| !s.is_empty())
            .unwrap_or_else(|| format!("Assignment {activity_id}"));
        let desc = doc.select(&sel(".activity-description")).next();
        let intro = desc.and_then(|n| n.select(&sel("#intro")).next());
        let content = intro.or(desc);
        let description = content.map(text_of).unwrap_or_default();
        let mut dates = Map::new();
        for node in doc.select(&sel(
            "[data-region=activity-dates] > div, .activity-dates > div",
        )) {
            let label = node
                .select(&sel("strong, b, .font-weight-bold"))
                .next()
                .map(text_of)
                .unwrap_or_default();
            let value = text_of(node);
            if !label.is_empty() && !value.is_empty() {
                let cleaned = value
                    .strip_prefix(&label)
                    .unwrap_or(&value)
                    .trim_start_matches(':')
                    .trim();
                dates.insert(label.trim_end_matches(':').to_string(), json!(cleaned));
            }
        }
        let image_extension = Regex::new(r"(?i)\.(png|jpe?g|gif|webp|svg)([?#]|$)").unwrap();
        let mut images = Vec::new();
        let mut resources = Vec::new();
        let mut seen = HashSet::new();
        if let Some(node) = content {
            for img in node.select(&sel("img")) {
                let src = if attr(img, "src").is_empty() {
                    attr(img, "data-src")
                } else {
                    attr(img, "src")
                };
                if src.is_empty() {
                    continue;
                }
                if !src.contains("/pluginfile.php/")
                    && !image_extension.is_match(src)
                {
                    continue;
                }
                if let Ok(url) =
                    Url::parse(src).or_else(|_| Url::parse(&self.base).and_then(|b| b.join(src)))
                {
                    if matches!(url.scheme(), "http" | "https") && seen.insert(url.to_string()) {
                        images.push(json!([
                            if !attr(img, "alt").is_empty() {
                                attr(img, "alt")
                            } else if !attr(img, "title").is_empty() {
                                attr(img, "title")
                            } else {
                                "Assignment image"
                            },
                            url.to_string()
                        ]));
                    }
                }
            }
            for a in node.select(&sel("a[href]")) {
                let href = attr(a, "href");
                if let Ok(url) =
                    Url::parse(href).or_else(|_| Url::parse(&self.base).and_then(|b| b.join(href)))
                {
                    if matches!(url.scheme(), "http" | "https") && seen.insert(url.to_string()) {
                        let label = text_of(a);
                        resources.push(json!([
                            if label.is_empty() {
                                "Assignment attachment".into()
                            } else {
                                label
                            },
                            url.to_string()
                        ]));
                    }
                }
            }
        }
        let tables: Vec<_> = doc.select(&sel("table")).collect();
        let status_table = tables
            .iter()
            .copied()
            .find(|t| has_class(*t, "submissionstatustable"))
            .or_else(|| {
                tables.iter().copied().find(|t| {
                    t.select(&sel("tr"))
                        .any(|r| text_of(r).to_lowercase().contains("submission status"))
                })
            });
        let mut status = Map::new();
        let mut submitted = Vec::new();
        if let Some(table) = status_table {
            for row in table.select(&sel("tr")) {
                let cells: Vec<_> = row
                    .children()
                    .filter_map(ElementRef::wrap)
                    .filter(|n| matches!(n.value().name(), "td" | "th"))
                    .map(text_of)
                    .collect();
                if cells.len() >= 2 {
                    let label = cells[0].trim_end_matches(':').to_string();
                    if label.to_lowercase() != "submission comments" {
                        status.insert(label, json!(cells[1..].join(" | ")));
                    }
                }
            }
            for a in table.select(&sel("a[href]")) {
                let href = attr(a, "href");
                let inside = a
                    .ancestors()
                    .filter_map(ElementRef::wrap)
                    .take_while(|n| n.value().name() != "table")
                    .any(|n| has_class(n, "fileuploadsubmission"));
                if (href.contains("/assignsubmission_file/") || inside) && !href.is_empty() {
                    if let Ok(url) = safe_url(&self.base, href) {
                        let label = text_of(a);
                        submitted.push(json!([
                            if label.is_empty() {
                                "Submitted file".into()
                            } else {
                                label
                            },
                            url
                        ]));
                    }
                }
            }
        }
        let due = status
            .iter()
            .find(|(k, _)| k.to_lowercase().contains("due date"))
            .map(|(_, v)| v.as_str().unwrap_or(""))
            .or_else(|| {
                dates
                    .iter()
                    .find(|(k, _)| k.to_lowercase().starts_with("due"))
                    .map(|(_, v)| v.as_str().unwrap_or(""))
            })
            .unwrap_or("");
        Ok(
            json!({"title":title,"description":description,"images":images,"resources":resources,"status":status,"submitted":submitted,"due":due,"dates":dates}),
        )
    }
    pub(super) fn quiz_details(&self, activity_id: &str) -> CliResult<Value> {
        let source = self.get(&format!("/mod/quiz/view.php?id={activity_id}"))?;
        let doc = page(&source);
        let title = doc
            .select(&sel("h1"))
            .map(text_of)
            .find(|text| !text.is_empty())
            .unwrap_or_default();
        let main = doc.select(&sel("#region-main, #page-content")).next();
        let text = main.map(text_of).unwrap_or_default();
        let date_pattern = r"(?i)(?:opened|opens|closed|closes):\s*((?:[A-Za-z]+,\s*)?\d{1,2}\s+[A-Za-z]+\s+\d{4},\s+\d{1,2}:\d{2}\s*[AP]M)";
        let mut opened = String::new();
        let mut closed = String::new();
        for captures in Regex::new(date_pattern).unwrap().captures_iter(&text) {
            let label = captures
                .get(0)
                .map(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let date = captures
                .get(1)
                .map(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if label.starts_with("open") {
                opened = date;
            } else {
                closed = date;
            }
        }
        let attempt_status = if text.contains("Summary of your previous attempts") {
            if text.contains("Finished") {
                "Finished"
            } else {
                "Previous attempt shown"
            }
        } else {
            "No previous attempt shown"
        };
        Ok(
            json!({"title":title,"opened":opened,"closed":closed,"attempt_status":attempt_status,"text":text}),
        )
    }
    pub(super) fn forum_discussions(&self, activity_id: &str) -> CliResult<Vec<Value>> {
        let doc = page(&self.get(&format!("/mod/forum/view.php?id={activity_id}"))?);
        let mut seen = HashSet::new();
        let mut out = Vec::new();
        for a in doc.select(&sel("a[href*='/mod/forum/discuss.php']")) {
            let url = safe_url(&self.base, attr(a, "href"))?;
            let parsed = Url::parse(&url).map_err(|_| "Invalid forum discussion URL.")?;
            if let Some(id) = parsed
                .query_pairs()
                .find(|(key, _)| key == "d")
                .map(|(_, v)| v.to_string())
            {
                let title = text_of(a);
                if !title.is_empty() && seen.insert(id.clone()) {
                    out.push(json!({"id":id,"title":title,"url":url}));
                }
            }
        }
        Ok(out)
    }
    pub(super) fn folder_files(&self, activity_id: &str) -> CliResult<Vec<Value>> {
        let doc = page(&self.get(&format!("/mod/folder/view.php?id={activity_id}"))?);
        let mut seen = HashSet::new();
        let mut files = Vec::new();
        for a in doc.select(&sel("main .foldertree a[href], .foldertree a[href]")) {
            let url = safe_url(&self.base, attr(a, "href"))?;
            if seen.insert(url.clone()) {
                files.push(json!({"name":text_of(a),"url":url}));
            }
        }
        Ok(files)
    }
    pub(super) fn page_content(&self, link: &str) -> CliResult<Value> {
        let url = safe_url(&self.base, link)?;
        let parsed = Url::parse(&url).map_err(|_| "Invalid Moodle page URL.")?;
        if !["/mod/page/", "/mod/book/", "/mod/folder/"]
            .iter()
            .any(|prefix| parsed.path().starts_with(prefix))
        {
            return Err("Page reader accepts Moodle page, book, or folder activity URLs.".into());
        }
        let source = self.get(&url)?;
        if Regex::new(r#"(?i)name=["']logintoken["']|id=["']login["']|loginerrormessage"#)
            .unwrap()
            .is_match(&source)
        {
            return Err("LMS session expired while reading this page.".into());
        }
        let doc = page(&source);
        let title = doc
            .select(&sel("h1"))
            .map(text_of)
            .find(|s| !s.is_empty())
            .unwrap_or_default();
        let content = doc.select(&sel(".mod_page-content, .book_content, .mod_book-chapter, #region-main .generalbox, #region-main")).next();
        let body = content.map(text_of).unwrap_or_default();
        let mut links = Vec::new();
        let mut seen = HashSet::new();
        if let Some(node) = content {
            for a in node.select(&sel("a[href]")) {
                let href = attr(a, "href");
                if let Ok(url) = Url::parse(href)
                    .or_else(|_| Url::parse(&self.base).and_then(|base| base.join(href)))
                {
                    if matches!(url.scheme(), "http" | "https") && seen.insert(url.to_string()) {
                        links.push(json!({"name":text_of(a),"url":url.to_string()}));
                    }
                }
            }
            for img in node.select(&sel("img[src]")) {
                let href = attr(img, "src");
                if let Ok(url) = Url::parse(href)
                    .or_else(|_| Url::parse(&self.base).and_then(|base| base.join(href)))
                {
                    if matches!(url.scheme(), "http" | "https") && seen.insert(url.to_string()) {
                        links.push(json!({"name":attr(img,"alt"),"url":url.to_string()}));
                    }
                }
            }
        }
        Ok(json!({"title":title,"text":body,"links":links}))
    }
    pub(super) fn forum_posts(&self, discussion_id: &str) -> CliResult<Vec<Value>> {
        let doc = page(&self.get(&format!("/mod/forum/discuss.php?d={discussion_id}"))?);
        let mut out = Vec::new();
        let mut seen = HashSet::new();
        for (index, post) in doc
            .select(&sel("[data-region=post], .forumpost"))
            .enumerate()
        {
            let id = [attr(post, "data-post-id"), attr(post, "id")]
                .into_iter()
                .find(|s| !s.is_empty())
                .unwrap_or("")
                .to_string();
            let id = if id.is_empty() { index.to_string() } else { id };
            if !seen.insert(id.clone()) {
                continue;
            }
            let content = post
                .select(&sel(
                    ".post-content-container, [data-region=post-content], .posting",
                ))
                .next();
            let mut attachments = Vec::new();
            let mut urls = HashSet::new();
            if let Some(content) = content {
                for a in content.select(&sel(
                    "a[href*='pluginfile.php'], a[href*='forcedownload=1']",
                )) {
                    if let Ok(url) = safe_url(&self.base, attr(a, "href")) {
                        if urls.insert(url.clone()) {
                            attachments.push(json!({"name":text_of(a),"url":url}));
                        }
                    }
                }
                for img in content.select(&sel("img[src*='pluginfile.php']")) {
                    if let Ok(url) = safe_url(&self.base, attr(img, "src")) {
                        if urls.insert(url.clone()) {
                            attachments.push(json!({"name":attr(img,"alt"),"url":url}));
                        }
                    }
                }
            }
            out.push(json!({"id":id,
                "title":post.select(&sel("[data-region-content='forum-post-core-subject'], .subject, h3")).next().map(text_of).unwrap_or_default(),
                "author":post.select(&sel("a[href*='/user/']")).next().map(text_of).unwrap_or_default(),
                "date":post.select(&sel("time")).next().map(|n|attr(n,"datetime")).unwrap_or(""),
                "body":content.map(text_of).unwrap_or_default(),"attachments":attachments}));
        }
        Ok(out)
    }
    pub(super) fn download_url(
        &self,
        link: &str,
        output: Option<&Path>,
        output_dir: Option<&Path>,
        force: bool,
    ) -> CliResult<PathBuf> {
        let url = safe_url(&self.base, link)?;
        let mut response = self
            .client
            .get(url)
            .header(ACCEPT, "*/*")
            .send()
            .map_err(|e| format!("Could not download LMS material ({}).", e))?;
        if !response.status().is_success() {
            return Err(format!(
                "LMS material download failed (HTTP {}).",
                response.status().as_u16()
            ));
        }
        let final_url = response.url().clone();
        safe_url(&self.base, final_url.as_str())?;
        if final_url.path().starts_with("/login/") {
            return Err("The LMS session expired; sign in again before downloading.".into());
        }
        let filename = download_filename(response.headers(), &final_url);
        let target = if let Some(path) = output {
            expand_path(&path.to_string_lossy())
        } else if let Some(directory) = output_dir {
            expand_path(&directory.to_string_lossy()).join(filename)
        } else {
            PathBuf::from(filename)
        };
        if let Some(parent) = target.parent().filter(|p| !p.as_os_str().is_empty()) {
            fs::create_dir_all(parent)
                .map_err(|_| "Could not create the download folder.".to_string())?;
        }
        if target.exists() && !force {
            return Err(format!(
                "{} already exists; choose another --output path or use --force to replace it.",
                target.display()
            ));
        }
        let file_name = target
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("download");
        let temporary = target.with_file_name(format!(".{file_name}.bunkialo-part"));
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| "Could not create a temporary download file.".to_string())?;
        if let Err(error) = io::copy(&mut response, &mut file) {
            let _ = fs::remove_file(&temporary);
            return Err(format!("Could not save the downloaded file ({}).", error));
        }
        drop(file);
        let install_result = if force {
            fs::rename(&temporary, &target)
        } else {
            fs::hard_link(&temporary, &target).and_then(|_| fs::remove_file(&temporary))
        };
        if install_result.is_err() {
            let _ = fs::remove_file(&temporary);
            return Err(if target.exists() && !force {
                format!(
                    "{} already exists; choose another --output path or use --force to replace it.",
                    target.display()
                )
            } else {
                format!("Could not install the download at {}.", target.display())
            });
        }
        Ok(target)
    }
    pub(super) fn download_assignment_materials(
        &self,
        activity_id: &str,
        output_dir: &Path,
        force: bool,
    ) -> CliResult<Vec<PathBuf>> {
        let details = self.assignment_details(activity_id)?;
        let mut links = value_arr(&details, "images");
        links.extend(value_arr(&details, "resources"));
        let mut saved = Vec::new();
        let mut seen = HashSet::new();
        for item in links {
            let Some(values) = item.as_array() else {
                continue;
            };
            let Some(link) = values.get(1).and_then(Value::as_str) else {
                continue;
            };
            let Ok(link) = safe_url(&self.base, link) else {
                continue;
            };
            if seen.insert(link.clone()) {
                saved.push(self.download_url(&link, None, Some(output_dir), force)?);
            }
        }
        Ok(saved)
    }
    pub(super) fn download_course_materials(
        &self,
        course_id: &str,
        output_dir: &Path,
        force: bool,
    ) -> CliResult<Vec<PathBuf>> {
        let (_, sections) = self.course_sections(course_id)?;
        let mut saved = Vec::new();
        for activity in sections
            .iter()
            .flat_map(|section| value_arr(section, "items"))
        {
            let kind = value_string(&activity, "type");
            let id = value_string(&activity, "id");
            let name = value_string(&activity, "name");
            let directory = output_dir.join(format!("{}-{id}", safe_filename(&name)));
            if kind == "assign" {
                saved.extend(self.download_assignment_materials(&id, &directory, force)?);
                continue;
            }
            if !["resource", "file", "folder", "page", "book"].contains(&kind.as_str()) {
                continue;
            }
            let url = value_string(&activity, "url");
            saved.push(self.download_url(&url, None, Some(&directory), force)?);
            if ["folder", "page", "book"].contains(&kind.as_str()) {
                let source = self.get(&url)?;
                for link in linked_moodle_files(&self.base, &source) {
                    saved.push(self.download_url(&link, None, Some(&directory), force)?);
                }
            }
        }
        Ok(saved)
    }
    pub(super) fn revert_to_draft_url(&self, activity_id: &str) -> CliResult<Option<String>> {
        let source = self.get(&format!("/mod/assign/view.php?id={activity_id}"))?;
        let doc = page(&source);
        for link in doc.select(&sel("a[href]")) {
            let href = attr(link, "href");
            let Ok(url) = Url::parse(href)
                .or_else(|_| Url::parse(&self.base).and_then(|base| base.join(href)))
            else {
                continue;
            };
            if url.host_str()
                != Url::parse(&self.base)
                    .ok()
                    .and_then(|v| v.host_str().map(str::to_string))
                    .as_deref()
                || url.scheme() != "https"
            {
                continue;
            }
            let params: HashMap<_, _> = url.query_pairs().into_owned().collect();
            if params.get("action").map(String::as_str) == Some("reverttodraft")
                && params.get("id").map(String::as_str) == Some(activity_id)
                && params.get("sesskey").is_some_and(|v| !v.is_empty())
            {
                return Ok(Some(url.to_string()));
            }
        }
        Ok(None)
    }
    pub(super) fn perform_revert_to_draft(&self, action_url: &str) -> CliResult<()> {
        let url = safe_url(&self.base, action_url)?;
        let response = self
            .client
            .get(url)
            .header(ACCEPT, "text/html")
            .send()
            .map_err(|e| format!("Moodle could not revert the submission ({}).", e))?;
        let html = response_text(response, "Moodle submission revert")?;
        if Regex::new(r#"(?i)name=[\"']logintoken[\"']|id=[\"']login[\"']|loginerrormessage"#)
            .unwrap()
            .is_match(&html)
        {
            return Err("Moodle session expired before the submission was reverted.".into());
        }
        Ok(())
    }
    pub(super) fn assignment_edit_session(&self, activity_id: &str) -> CliResult<Value> {
        let path = format!(
            "/mod/assign/view.php?id={}&action=editsubmission",
            url::form_urlencoded::byte_serialize(activity_id.as_bytes()).collect::<String>()
        );
        let source = self.get(&path)?;
        let doc = page(&source);
        let form = doc
            .select(&sel("form[method=post]"))
            .find(|f| attr(*f, "action").contains("/mod/assign/view.php"))
            .ok_or("Moodle did not provide an editable submission form for this assignment.")?;
        let fields = hidden_fields(form);
        if fields.get("action").map(String::as_str) != Some("savesubmission")
            || !fields.contains_key("sesskey")
        {
            return Err(
                "The Moodle edit form is missing expected submission fields; nothing was uploaded."
                    .into(),
            );
        }
        let config = parse_filemanager_config(&source).unwrap_or_else(|| json!({}));
        let file_field = fields
            .keys()
            .find(|k| k.ends_with("files_filemanager"))
            .cloned();
        let file_item = file_field
            .as_ref()
            .and_then(|k| fields.get(k))
            .cloned()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                config
                    .get("itemid")
                    .map(|v| v.to_string().trim_matches('"').to_string())
            })
            .unwrap_or_default();
        let repos = config
            .pointer("/filepicker/repositories")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        let mut repo_id = String::new();
        for (key, repo) in repos {
            if repo.get("type").and_then(Value::as_str) == Some("upload") {
                repo_id = repo
                    .get("id")
                    .map(|v| v.to_string().trim_matches('"').to_string())
                    .unwrap_or(key);
                break;
            }
        }
        let accepted = config
            .pointer("/filepicker/accepted_types")
            .or_else(|| config.get("accepted_types"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let text_area = form
            .select(&sel("textarea[name]"))
            .find(|t| attr(*t, "name").ends_with("[text]"));
        let online = text_area
            .map(|t| attr(t, "name").to_string())
            .unwrap_or_default();
        let online_value = text_area.map(text_of).unwrap_or_default();
        let action = attr(form, "action");
        let action_url = safe_url(&self.base, if action.is_empty() { &path } else { action })?;
        Ok(
            json!({"fields":fields,"action_url":action_url,"file_item_id":file_item,"repository_id":repo_id,"accepted_types":accepted,"max_files":config.get("maxfiles"),"max_bytes":config.get("maxbytes"),"client_id":config.get("client_id"),"context_id":config.pointer("/context/id"),"author":config.pointer("/filepicker/author").or_else(||config.get("author")).and_then(Value::as_str).unwrap_or(&self.username),"license":config.pointer("/filepicker/defaultlicense").or_else(||config.get("defaultlicense")).and_then(Value::as_str).unwrap_or("unknown"),"online_field":online,"online_value":online_value}),
        )
    }
    pub(super) fn upload_assignment_draft(
        &self,
        session: &Value,
        file_path: &str,
    ) -> CliResult<(String, String)> {
        let item = value_string(session, "file_item_id");
        let repo = value_string(session, "repository_id");
        if item.is_empty() || repo.is_empty() {
            return Err("This assignment does not expose Moodle's file upload control.".into());
        }
        let path = expand_path(file_path);
        let meta = fs::metadata(&path).map_err(|_| format!("File not found: {file_path}"))?;
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("upload.bin")
            .to_string();
        let size = meta.len();
        let max_bytes = session
            .get("max_bytes")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        if max_bytes > 0 && size as i64 > max_bytes {
            return Err(format!(
                "{name} is larger than the assignment's {max_bytes}-byte limit."
            ));
        }
        let max_files = session.get("max_files").and_then(Value::as_i64);
        if max_files == Some(0) {
            return Err("This assignment does not allow file submissions.".into());
        }
        let accepted = value_arr(session, "accepted_types")
            .iter()
            .filter_map(Value::as_str)
            .map(|s| s.to_lowercase())
            .collect::<Vec<_>>();
        let ext = path
            .extension()
            .and_then(|v| v.to_str())
            .map(|s| format!(".{}", s.to_lowercase()))
            .unwrap_or_default();
        if !accepted.is_empty()
            && !accepted
                .iter()
                .any(|a| a == "*" || a == "document" || a == &ext)
        {
            return Err(format!(
                "File type {} is not accepted; Moodle allows: {}",
                if ext.is_empty() {
                    "(no extension)"
                } else {
                    &ext
                },
                accepted.join(", ")
            ));
        }
        if size > 100 * 1024 * 1024 {
            return Err("Files over 100 MiB are not supported by this CLI upload path.".into());
        }
        let mut form = reqwest::blocking::multipart::Form::new();
        let field_values = vec![
            ("title", name.clone()),
            ("author", value_string(session, "author")),
            ("license", value_string(session, "license")),
            ("repo_id", repo),
            ("p", String::new()),
            ("page", String::new()),
            ("env", "filemanager".into()),
            (
                "sesskey",
                session
                    .pointer("/fields/sesskey")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .into(),
            ),
            ("itemid", item),
            (
                "maxbytes",
                if max_bytes != 0 {
                    max_bytes.to_string()
                } else {
                    "-1".into()
                },
            ),
            ("areamaxbytes", "-1".into()),
            ("savepath", "/".into()),
        ];
        for (k, v) in field_values {
            form = form.text(k.to_string(), v);
        }
        if let Some(v) = session.get("client_id").filter(|v| !v.is_null()) {
            form = form.text(
                "client_id",
                v.as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| v.to_string()),
            );
        }
        if let Some(v) = session.get("context_id").filter(|v| !v.is_null()) {
            form = form.text(
                "ctx_id",
                v.as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| v.to_string()),
            );
        }
        for a in &accepted {
            form = form.text("accepted_types[]", a.clone());
        }
        let part = reqwest::blocking::multipart::Part::file(&path)
            .map_err(|_| "Could not read selected upload file.".to_string())?
            .file_name(name.clone())
            .mime_str(
                mime_guess::from_path(&path)
                    .first_or_octet_stream()
                    .as_ref(),
            )
            .map_err(|_| "Invalid upload MIME type.".to_string())?;
        form = form.part("repo_upload_file", part);
        let url = safe_url(&self.base, "/repository/repository_ajax.php?action=upload")?;
        let response = self
            .client
            .post(url)
            .header(ACCEPT, "application/json")
            .multipart(form)
            .send()
            .map_err(|e| format!("Moodle draft upload failed ({}).", e))?;
        let result: Value = serde_json::from_str(&response_text(response, "Moodle draft upload")?)
            .map_err(|_| {
                "Moodle returned an unreadable response to the draft upload.".to_string()
            })?;
        if !result.get("error").unwrap_or(&Value::Null).is_null()
            || result.get("event").and_then(Value::as_str) == Some("error")
        {
            return Err(result
                .get("error")
                .or_else(|| result.get("msg"))
                .and_then(Value::as_str)
                .unwrap_or("Moodle rejected the draft upload.")
                .into());
        }
        Ok((
            result
                .get("itemid")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .unwrap_or_else(|| value_string(session, "file_item_id")),
            result
                .get("file")
                .or_else(|| result.get("title"))
                .and_then(Value::as_str)
                .unwrap_or(&name)
                .into(),
        ))
    }
    pub(super) fn save_assignment_submission(
        &self,
        session: &Value,
        draft_item_id: &str,
        online_html: Option<&str>,
    ) -> CliResult<String> {
        let mut fields: HashMap<String, String> = session
            .get("fields")
            .and_then(Value::as_object)
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").into()))
                    .collect()
            })
            .unwrap_or_default();
        if let Some(key) = fields
            .keys()
            .find(|k| k.ends_with("files_filemanager"))
            .cloned()
        {
            fields.insert(key, draft_item_id.into());
        } else if fields.contains_key("files_filemanager") {
            fields.insert("files_filemanager".into(), draft_item_id.into());
        }
        let online_field = value_string(session, "online_field");
        if let Some(text) = online_html.filter(|_| !online_field.is_empty()) {
            fields.insert(online_field.clone(), text.into());
            let base = online_field.strip_suffix("[text]").unwrap_or("");
            if !base.is_empty() {
                fields
                    .entry(format!("{base}[format]"))
                    .or_insert("1".into());
                fields
                    .entry(format!("{base}[itemid]"))
                    .or_insert(draft_item_id.into());
            }
        }
        let url = value_string(session, "action_url");
        let response = self
            .client
            .post(url)
            .header(ACCEPT, "text/html")
            .form(&fields)
            .send()
            .map_err(|e| format!("Moodle did not save the assignment submission ({}).", e))?;
        let html = response_text(response, "Moodle submission")?;
        if Regex::new(r#"(?i)name=["']logintoken["']|id=["']login["']|loginerrormessage"#)
            .unwrap()
            .is_match(&html)
        {
            return Err("Moodle session expired before the submission was saved.".into());
        }
        let doc = page(&html);
        let has = doc
            .select(&sel("table.submissionstatustable"))
            .next()
            .is_some()
            || doc
                .select(&sel("tr"))
                .any(|r| text_of(r).to_lowercase().contains("submission status"));
        if !has {
            return Err("Moodle returned no submission status confirmation; check the assignment page before retrying.".into());
        }
        Ok(self.main_text(&html))
    }
    pub(super) fn submit_for_grading_form(&self, activity_id: &str) -> CliResult<Value> {
        let source = self.get(&format!(
            "/mod/assign/view.php?id={activity_id}&action=submit"
        ))?;
        let doc = page(&source);
        let form = doc
            .select(&sel("form[method=post]"))
            .find(|form| {
                hidden_fields(*form).get("action").map(String::as_str) == Some("confirmsubmit")
            })
            .ok_or("Moodle did not provide a final submission confirmation form.")?;
        let mut fields = hidden_fields(form);
        if fields.get("id").map(String::as_str) != Some(activity_id)
            || !fields.contains_key("sesskey")
        {
            return Err("Moodle's final submission form is missing expected fields.".into());
        }
        if let Some(statement) = form
            .select(&sel("input[type=checkbox][name]"))
            .find(|input| {
                attr(*input, "name")
                    .to_lowercase()
                    .contains("submissionstatement")
            })
        {
            let label = statement
                .ancestors()
                .filter_map(ElementRef::wrap)
                .take(4)
                .map(text_of)
                .find(|text| !text.is_empty())
                .unwrap_or_else(|| {
                    "Moodle requires you to accept its submission statement.".into()
                });
            return Err(format!(
                "Moodle requires explicit acceptance of this statement before final submission: {label}. Use the LMS page to review and accept it; the CLI will not attest on your behalf."
            ));
        }
        if let Some(button) = form
            .select(&sel("input[type=submit][name], button[type=submit][name]"))
            .next()
        {
            let name = attr(button, "name");
            if !name.is_empty() {
                fields.insert(name.into(), attr(button, "value").into());
            }
        }
        let action = attr(form, "action");
        let fallback = format!("/mod/assign/view.php?id={activity_id}");
        let action_url = safe_url(
            &self.base,
            if action.is_empty() { &fallback } else { action },
        )?;
        Ok(json!({"action_url":action_url,"fields":fields}))
    }
    pub(super) fn post_submit_for_grading(&self, form: &Value) -> CliResult<()> {
        let fields: HashMap<String, String> = form
            .get("fields")
            .and_then(Value::as_object)
            .map(|obj| {
                obj.iter()
                    .map(|(key, value)| (key.clone(), value.as_str().unwrap_or("").to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let url = value_string(form, "action_url");
        let response = self
            .client
            .post(url)
            .header(ACCEPT, "text/html")
            .form(&fields)
            .send()
            .map_err(|e| format!("Moodle did not accept the final submission ({}).", e))?;
        let html = response_text(response, "Moodle final submission")?;
        if Regex::new(r#"(?i)name=[\"']logintoken[\"']|id=[\"']login[\"']|loginerrormessage"#)
            .unwrap()
            .is_match(&html)
        {
            return Err("Moodle session expired before final submission.".into());
        }
        let text = self.main_text(&html).to_lowercase();
        if text.contains("submission status") || text.contains("submitted for grading") {
            Ok(())
        } else {
            Err("Moodle returned no recognizable final-submission status; check the assignment page before retrying.".into())
        }
    }
    pub(super) fn main_text(&self, source: &str) -> String {
        let doc = page(source);
        let region = doc.select(&sel("#region-main, #page-content")).next();
        let text = region
            .map(text_of)
            .unwrap_or_else(|| text_of(doc.root_element()));
        text.chars().take(9000).collect()
    }
}

fn download_filename(headers: &reqwest::header::HeaderMap, url: &Url) -> String {
    let disposition = headers
        .get(CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let encoded = disposition
        .split(';')
        .map(str::trim)
        .find_map(|part| part.strip_prefix("filename*="))
        .map(|value| value.trim_matches('"'));
    let ordinary = disposition
        .split(';')
        .map(str::trim)
        .find_map(|part| part.strip_prefix("filename="))
        .map(|value| value.trim_matches('"'));
    let from_header = encoded
        .map(|value| {
            value
                .split_once("''")
                .map(|(_, name)| name)
                .unwrap_or(value)
        })
        .or(ordinary);
    let from_header = from_header.map(|name| {
        url::form_urlencoded::parse(format!("name={name}").as_bytes())
            .next()
            .map(|(_, value)| value.into_owned())
            .unwrap_or_else(|| name.into())
    });
    let from_url = url
        .path_segments()
        .and_then(Iterator::last)
        .filter(|name| !name.is_empty());
    let mut name = from_header
        .as_deref()
        .or(from_url)
        .unwrap_or("download")
        .to_string();
    if ["view.php", "index.php", "download.php"].contains(&name.to_lowercase().as_str()) {
        name = "download".into();
    }
    let mut name = safe_filename(&name);
    if headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/html"))
        && Path::new(&name).extension().is_none()
    {
        name.push_str(".html");
    }
    name
}

fn safe_filename(name: &str) -> String {
    let normalized = name.replace('\\', "/");
    let basename = Path::new(&normalized)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let cleaned = basename
        .chars()
        .map(|ch| if ch.is_control() { '_' } else { ch })
        .collect::<String>();
    let cleaned = cleaned.trim_matches(['.', ' ']);
    if cleaned.is_empty() {
        "download".into()
    } else {
        cleaned.into()
    }
}

fn linked_moodle_files(base: &str, source: &str) -> Vec<String> {
    let doc = page(source);
    let mut links = HashSet::new();
    for node in doc.select(&sel(
        "a[href*='/pluginfile.php/'], img[src*='/pluginfile.php/']",
    )) {
        let link = if attr(node, "href").is_empty() {
            attr(node, "src")
        } else {
            attr(node, "href")
        };
        if let Ok(link) = safe_url(base, link) {
            links.insert(link);
        }
    }
    links.into_iter().collect()
}

fn parse_filemanager_config(source: &str) -> Option<Value> {
    let marker = "M.form_filemanager.init(Y,";
    let at = source.find(marker)?;
    let start = source[at + marker.len()..].find('{')? + at + marker.len();
    let bytes = source.as_bytes();
    let mut depth = 0;
    let mut quoted = false;
    let mut esc = false;
    for i in start..bytes.len() {
        let c = bytes[i] as char;
        if quoted {
            if esc {
                esc = false
            } else if c == '\\' {
                esc = true
            } else if c == '"' {
                quoted = false
            }
            continue;
        }
        if c == '"' {
            quoted = true
        } else if c == '{' {
            depth += 1
        } else if c == '}' {
            depth -= 1;
            if depth == 0 {
                return serde_json::from_str(&source[start..=i]).ok();
            }
        }
    }
    None
}
