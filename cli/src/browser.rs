#[cfg(target_os = "linux")]
use std::time::Duration;

pub(crate) fn open(url: &str) -> bool {
    if webbrowser::open(url).is_err() {
        return false;
    }
    #[cfg(target_os = "linux")]
    activate_default_browser();
    true
}

#[cfg(target_os = "linux")]
fn activate_default_browser() {
    use std::process::Command;
    if std::env::var_os("HYPRLAND_INSTANCE_SIGNATURE").is_none() {
        return;
    }
    let Some(class) = default_browser_class() else {
        return;
    };
    for _ in 0..10 {
        let Ok(output) = Command::new("hyprctl").args(["-j", "clients"]).output() else {
            return;
        };
        if let Some(address) = focus_target(&output.stdout, &class) {
            let _ = Command::new("hyprctl")
                .args(["dispatch", "focuswindow", &format!("address:{address}")])
                .output();
            return;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

#[cfg(target_os = "linux")]
fn default_browser_class() -> Option<String> {
    use std::path::PathBuf;
    use std::process::Command;
    let output = Command::new("xdg-settings")
        .args(["get", "default-web-browser"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let desktop = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    if !desktop.ends_with(".desktop") || desktop.contains('/') || desktop.contains('\\') {
        return None;
    }
    let mut paths = Vec::new();
    let user_data = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
        })?;
    paths.push(user_data);
    let system_data =
        std::env::var_os("XDG_DATA_DIRS").unwrap_or_else(|| "/usr/local/share:/usr/share".into());
    paths.extend(std::env::split_paths(&system_data));
    for path in paths {
        if let Ok(file) = std::fs::read_to_string(path.join("applications").join(&desktop)) {
            let mut entry = false;
            for line in file.lines() {
                if line.starts_with('[') {
                    entry = line == "[Desktop Entry]";
                }
                if entry {
                    if let Some(class) = line
                        .strip_prefix("StartupWMClass=")
                        .filter(|value| !value.is_empty())
                    {
                        return Some(class.into());
                    }
                }
            }
        }
    }
    None
}

#[cfg(any(target_os = "linux", test))]
fn focus_target(raw: &[u8], class: &str) -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Window {
        address: String,
        class: String,
        #[serde(rename = "initialClass")]
        initial_class: String,
        #[serde(rename = "focusHistoryID")]
        focus_history: i64,
        mapped: bool,
        hidden: bool,
    }
    let windows: Vec<Window> = serde_json::from_slice(raw).ok()?;
    windows
        .into_iter()
        .filter(|window| {
            window.mapped
                && !window.hidden
                && (window.class.eq_ignore_ascii_case(class)
                    || window.initial_class.eq_ignore_ascii_case(class))
                && window.address.strip_prefix("0x").is_some_and(|value| {
                    !value.is_empty() && value.chars().all(|c| c.is_ascii_hexdigit())
                })
        })
        .min_by_key(|window| {
            if window.focus_history < 0 {
                i64::MAX
            } else {
                window.focus_history
            }
        })
        .map(|window| window.address)
}

#[cfg(test)]
mod tests {
    use super::focus_target;
    #[test]
    fn focuses_recent_matching_browser_and_ignores_other_windows() {
        let raw = br#"[
          {"address":"0x123","class":"zen","initialClass":"zen","focusHistoryID":5,"mapped":true,"hidden":false},
          {"address":"0x456","class":"Zen","initialClass":"zen","focusHistoryID":1,"mapped":true,"hidden":false},
          {"address":"0x789","class":"terminal","initialClass":"terminal","focusHistoryID":0,"mapped":true,"hidden":false}
        ]"#;
        assert_eq!(focus_target(raw, "zen"), Some("0x456".into()));
        assert_eq!(focus_target(raw, "firefox"), None);
    }
}
