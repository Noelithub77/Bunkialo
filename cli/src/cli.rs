use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "bunkialo",
    about = "IIIT Kottayam LMS and attendance CLI",
    version
)]
pub(crate) struct Cli {
    #[command(subcommand)]
    pub(crate) command: Command,
}

#[derive(Subcommand)]
pub(crate) enum Command {
    #[command(about = "Open a local browser page to connect LMS and attendance accounts")]
    Login,
    #[command(about = "Log in to campus Wi-Fi using its own DNS and saved LMS credentials")]
    Wifix {
        #[command(subcommand)]
        command: Option<WifixCommand>,
    },
    #[command(about = "Check or store portal credentials")]
    Auth {
        #[command(subcommand)]
        command: AuthCommand,
    },
    #[command(about = "Read Moodle course data")]
    Lms {
        #[command(subcommand)]
        command: LmsCommand,
    },
    #[command(about = "Read the separate UG Attendance System")]
    Attendance {
        #[command(subcommand)]
        command: AttendanceCommand,
    },
}

#[derive(Subcommand)]
pub(crate) enum WifixCommand {
    #[command(about = "Log in to campus Wi-Fi (also the default wifix action)")]
    Login,
    #[command(about = "Log out of the campus portal while keeping Wi-Fi connected")]
    Logout,
    #[command(about = "Check campus Wi-Fi connectivity without logging in or out")]
    Status,
}

#[derive(Subcommand)]
pub(crate) enum AuthCommand {
    Status,
    Store,
}

#[derive(Subcommand)]
pub(crate) enum LmsCommand {
    Courses,
    Deadlines {
        #[arg(long, default_value_t = 30)]
        days: i64,
        #[arg(long, default_value_t = 50)]
        limit: i64,
    },
    #[command(about = "Assignment and quiz timeline for the past and next 30 days")]
    Recent,
    Course {
        course_id: String,
    },
    Content {
        #[arg(long)]
        course: Option<String>,
    },
    Assignments {
        #[arg(long)]
        course: Option<String>,
    },
    Resources {
        course_id: String,
    },
    Page {
        url: String,
    },
    Download {
        url: String,
        #[arg(long)]
        output: Option<String>,
        #[arg(long)]
        force: bool,
    },
    DownloadAssignment {
        activity_id: String,
        #[arg(long)]
        output_dir: Option<String>,
        #[arg(long)]
        force: bool,
    },
    DownloadCourse {
        course_id: String,
        #[arg(long)]
        output_dir: Option<String>,
        #[arg(long)]
        force: bool,
    },
    Assignment {
        activity_id: String,
    },
    Quiz {
        activity_id: String,
    },
    Forum {
        activity_id: String,
    },
    Discussion {
        discussion_id: String,
    },
    Submit(SubmitArgs),
    Unsubmit {
        activity_id: String,
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Args)]
pub(crate) struct SubmitArgs {
    pub(crate) activity_id: String,
    #[arg(long = "file", action = clap::ArgAction::Append)]
    pub(crate) files: Vec<String>,
    #[arg(long, conflicts_with_all = ["text_file"])]
    pub(crate) text: Option<String>,
    #[arg(long, conflicts_with = "text")]
    pub(crate) text_file: Option<String>,
    #[arg(long)]
    pub(crate) dry_run: bool,
}

#[derive(Subcommand)]
pub(crate) enum AttendanceCommand {
    Profile,
    Terms,
    Summary,
    #[command(about = "Calculate existing classes needing duty leave credit to reach 80%")]
    Dl {
        /// Optional course code or attendance course ID; defaults to all courses
        course_id: Option<String>,
        /// Print a structured report instead of the attendance table
        #[arg(long)]
        json: bool,
    },
    Sessions {
        course_id: Option<String>,
    },
    Report {
        course_id: Option<String>,
    },
    Appeal {
        session_id: String,
        #[arg(long)]
        dry_run: bool,
    },
    ApplyLeave {
        #[arg(long)]
        dry_run: bool,
    },
    ApplyMedicalLeave {
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Parser)]
#[command(name = "wifix", about = "Log in to campus Wi-Fi", version)]
pub(crate) struct WifixCli {
    #[command(subcommand)]
    pub(crate) command: Option<WifixCommand>,
}
