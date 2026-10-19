use clap::{Args, Parser, Subcommand};

const COLLEGE_POLICIES: &str = "College policies and attendance planning:
  Planning target: strictly above 80% in each course, with a buffer rather than
  stopping at exactly 80%. This is the user's planning convention; college rules,
  duty leave eligibility, limits and approval must be confirmed with the college.

  For duty leave handled by removing an absent session:
    projected attendance = attended / (total sessions - approved removals) * 100
  Keep attended unchanged. Count recorded sessions, not hours: a two-hour class
  stored as one session is one removal. Only remove matching absent sessions.

  Re-fetch live records after faculty updates. A session already marked present
  or already removed must not be counted again as pending duty leave. Keep each
  student's records separate and deduplicate internship and event claims.

  Internship and event leave are conditional until approved. Match the student's
  actual duty dates and sessions; nearby dates alone do not establish eligibility.
  Internship cutoffs belong to the individual approval, not a universal policy.

  Example: 28/39 with six approved absent-session removals becomes 28/33 (84.85%).
  If one of those six is rejected, 28/34 is still 82.35%. Check this buffer per
  course; future absences or newly uploaded sessions require recalculation.

  Calculator limitation: attendance dl currently models absence-to-credit
  conversion with a fixed total, not session removal. Do not use its projections
  for the removal model above. Read attendance summary and report for live data.";

#[derive(Parser)]
#[command(
    name = "bunkialo",
    about = "IIIT Kottayam LMS and attendance CLI",
    version,
    after_help = COLLEGE_POLICIES
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
    #[command(
        about = "Read the separate UG Attendance System",
        after_help = COLLEGE_POLICIES
    )]
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
    #[command(
        about = "Calculate existing classes needing duty leave credit to reach 80%",
        after_help = "This calculator converts absences to credits while keeping the total fixed. It does not calculate absent-session removal. For the removal formula, approval assumptions and safety buffers, run bunkialo attendance --help."
    )]
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
