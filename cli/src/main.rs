mod attendance;
mod auth;
mod cli;
mod common;
mod lms;
mod login;

use clap::Parser;
use cli::{Cli, Command};

fn main() {
    let cli = Cli::parse();
    let result = match cli.command {
        Command::Login => login::run(),
        Command::Auth { command } => auth::run(command),
        Command::Lms { command } => lms::run(command),
        Command::Attendance { command } => attendance::run(command),
    };
    if let Err(error) = result {
        eprintln!("bunkialo: {error}");
        std::process::exit(2);
    }
}
