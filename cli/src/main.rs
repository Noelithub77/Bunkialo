mod attendance;
mod auth;
mod browser;
mod cli;
mod common;
mod lms;
mod login;
mod wifix;

use clap::Parser;
use cli::{Cli, Command};

fn main() {
    let alias = std::env::args_os().next().is_some_and(|path| {
        std::path::Path::new(&path).file_stem() == Some(std::ffi::OsStr::new("wifix"))
    });
    let result = if alias {
        wifix::run(cli::WifixCli::parse().command)
    } else {
        let cli = Cli::parse();
        match cli.command {
            Command::Login => login::run(),
            Command::Auth { command } => auth::run(command),
            Command::Lms { command } => lms::run(command),
            Command::Attendance { command } => attendance::run(command),
            Command::Wifix { command } => wifix::run(command),
        }
    };
    if let Err(error) = result {
        eprintln!("bunkialo: {error}");
        std::process::exit(2);
    }
}
