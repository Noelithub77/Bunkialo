use crate::cli::AuthCommand;
use crate::common::{auth_entry, input, stored_value, CliResult};
use std::env;

pub(crate) fn run(command: AuthCommand) -> CliResult<()> {
    match command {
        AuthCommand::Status => {
            let usable = auth_entry("probe").is_ok();
            println!(
                "OS keyring: {}",
                if usable { "available" } else { "unavailable" }
            );
            for (name, envs, accounts) in [
                (
                    "LMS",
                    ["BUNKIALO_LMS_USERNAME", "BUNKIALO_LMS_PASSWORD"],
                    ["lms.username", "lms.password"],
                ),
                (
                    "Attendance",
                    ["BUNKIALO_ATTENDANCE_EMAIL", "BUNKIALO_ATTENDANCE_PASSWORD"],
                    ["attendance.email", "attendance.password"],
                ),
            ] {
                let configured = (0..2).all(|i| {
                    env::var(envs[i]).map(|s| !s.is_empty()).unwrap_or(false)
                        || env::var(envs[i].replacen("BUNKIALO_", "ACADS_", 1))
                            .map(|s| !s.is_empty())
                            .unwrap_or(false)
                        || stored_value(accounts[i]).is_some()
                });
                println!(
                    "{name} credentials: {}",
                    if configured {
                        "configured"
                    } else {
                        "not configured"
                    }
                );
            }
            Ok(())
        }
        AuthCommand::Store => {
            let values = [
                ("lms.username", input("LMS username: ")?),
                (
                    "lms.password",
                    rpassword::prompt_password("LMS password: ")
                        .map_err(|_| "Could not read password prompt.".to_string())?,
                ),
                ("attendance.email", input("Attendance email: ")?),
                (
                    "attendance.password",
                    rpassword::prompt_password("Attendance password: ")
                        .map_err(|_| "Could not read password prompt.".to_string())?,
                ),
            ];
            if values.iter().any(|(_, v)| v.is_empty()) {
                return Err(
                    "No keyring values were saved because one or more fields were empty.".into(),
                );
            }
            for (account, value) in values {
                auth_entry(account)?.set_password(&value).map_err(|_|"The OS keyring refused the save; credentials were not written to a plaintext file.".to_string())?;
            }
            println!("Credentials saved to the OS keyring under the bunkialo-cli service.");
            Ok(())
        }
    }
}
