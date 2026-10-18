use crate::common::CliResult;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub(super) const ASSUMPTION: &str = "Each additional credited duty leave converts one existing absence to attendance credit; total classes stay fixed. Eligibility, approval and portal credit limits are not checked.";

#[derive(Deserialize)]
struct Summary {
    #[serde(rename = "byCourse", alias = "courses")]
    courses: Vec<Course>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Course {
    course_id: String,
    #[serde(alias = "code")]
    course_code: String,
    #[serde(alias = "name")]
    course_name: String,
    present: u64,
    total: u64,
    #[serde(default)]
    dl_credited: u64,
    #[serde(default)]
    dl_overflow: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CourseReport {
    course_id: String,
    course_code: String,
    course_name: String,
    present: u64,
    total: u64,
    dl_credited: u64,
    dl_overflow: u64,
    credited_attendance: u64,
    current_percentage: Option<f64>,
    additional_dl_needed: u64,
    projected_percentage: Option<f64>,
    additional_dl_needed_above_80: u64,
    status: &'static str,
}

fn percentage(credited: u64, total: u64) -> Option<f64> {
    (total > 0).then(|| credited as f64 * 100.0 / total as f64)
}

pub(super) fn calculate(data: Value, requested: Option<&str>) -> CliResult<Vec<CourseReport>> {
    let summary: Summary = serde_json::from_value(data)
        .map_err(|_| "Attendance portal returned missing or invalid course counts.".to_string())?;
    let mut courses = summary.courses;
    if let Some(requested) = requested.filter(|id| !id.eq_ignore_ascii_case("all")) {
        courses.retain(|course| {
            course.course_id == requested || course.course_code.eq_ignore_ascii_case(requested)
        });
        if courses.is_empty() {
            return Err(format!(
                "Attendance course {requested} was not in the current summary."
            ));
        }
    }
    if courses.is_empty() {
        return Err("No course attendance is available in the current summary.".into());
    }

    courses
        .into_iter()
        .map(|course| {
            let credited = course
                .present
                .checked_add(course.dl_credited)
                .filter(|count| *count <= course.total)
                .ok_or_else(|| format!("Invalid attendance counts for {}.", course.course_code))?;
            // Use exact integer arithmetic: duty leave changes the numerator only.
            let required = (u128::from(course.total) * 4).div_ceil(5) as u64;
            let needed = required.saturating_sub(credited);
            let above_80 = if course.total > 0 {
                (u128::from(course.total) * 4 / 5 + 1) as u64
            } else {
                0
            };
            Ok(CourseReport {
                course_id: course.course_id,
                course_code: course.course_code,
                course_name: course.course_name,
                present: course.present,
                total: course.total,
                dl_credited: course.dl_credited,
                dl_overflow: course.dl_overflow,
                credited_attendance: credited,
                current_percentage: percentage(credited, course.total),
                additional_dl_needed: needed,
                projected_percentage: percentage(credited + needed, course.total),
                additional_dl_needed_above_80: above_80.saturating_sub(credited),
                status: if course.total == 0 {
                    "no_classes"
                } else if needed == 0 {
                    "safe"
                } else {
                    "needs_dl"
                },
            })
        })
        .collect()
}

pub(super) fn print_report(courses: &[CourseReport]) {
    println!("Additional duty leave credits needed for at least 80%");
    println!(
        "Course\tAttendance (including credited duty leave)\tConvert to duty leave\tAfter credit"
    );
    for course in courses {
        if let (Some(current), Some(projected)) =
            (course.current_percentage, course.projected_percentage)
        {
            println!(
                "{} — {}\t{}/{} ({current:.2}%)\t{}\t{projected:.2}%{}",
                course.course_code,
                course.course_name,
                course.credited_attendance,
                course.total,
                course.additional_dl_needed,
                if course.status == "safe" {
                    " (already safe)"
                } else {
                    ""
                }
            );
            if course.additional_dl_needed_above_80 > course.additional_dl_needed {
                println!(
                    "  {} credits reach exactly 80%; {} are needed for strictly above 80%.",
                    course.additional_dl_needed, course.additional_dl_needed_above_80
                );
            }
            if course.dl_overflow > 0 {
                println!(
                    "  {} duty leave records are not credited by the portal and are excluded.",
                    course.dl_overflow
                );
            }
        } else {
            println!(
                "{} — {}\tNo classes recorded",
                course.course_code, course.course_name
            );
        }
    }
    println!("\n{ASSUMPTION}");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn course(present: u64, total: u64, dl: u64) -> Value {
        json!({"courseId":"course-1", "courseCode":"CSS311", "courseName":"Test course",
            "present":present, "total":total, "dlCredited":dl})
    }

    #[test]
    fn converts_existing_classes_without_increasing_total() {
        for (present, total, needed) in [
            (40, 45, 0),
            (33, 47, 5),
            (28, 39, 4),
            (10, 13, 1),
            (11, 13, 0),
            (35, 44, 1),
            (8, 11, 1),
            (13, 25, 7),
        ] {
            let reports = calculate(json!({"byCourse":[course(present, total, 0)]}), None).unwrap();
            let report = &reports[0];
            assert_eq!(report.additional_dl_needed, needed);
            assert_eq!(report.total, total);
            assert!(report.projected_percentage.unwrap() >= 80.0);
            if needed > 0 {
                assert!((present + needed - 1) * 5 < total * 4);
            }
        }
    }

    #[test]
    fn credits_existing_duty_leave_but_excludes_overflow() {
        let mut data = course(33, 47, 2);
        data["dlOverflow"] = json!(3);
        let reports = calculate(json!({"byCourse":[data]}), None).unwrap();
        assert_eq!(reports[0].credited_attendance, 35);
        assert_eq!(reports[0].additional_dl_needed, 3);
        assert_eq!(reports[0].dl_overflow, 3);
    }

    #[test]
    fn distinguishes_exactly_80_from_above_80_and_empty_records() {
        let reports = calculate(json!({"byCourse":[course(20, 25, 0)]}), None).unwrap();
        assert_eq!(reports[0].status, "safe");
        assert_eq!(reports[0].additional_dl_needed, 0);
        assert_eq!(reports[0].additional_dl_needed_above_80, 1);
        let reports = calculate(json!({"byCourse":[course(0, 0, 0)]}), None).unwrap();
        assert_eq!(reports[0].status, "no_classes");
        assert!(reports[0].current_percentage.is_none());
    }

    #[test]
    fn selects_course_and_accepts_portal_metadata_aliases() {
        let data = json!({"courses":[{"courseId":"course-1", "code":"CSS311",
            "name":"Test course", "present":33, "total":47}]});
        for filter in ["css311", "course-1", "all"] {
            assert_eq!(calculate(data.clone(), Some(filter)).unwrap().len(), 1);
        }
        assert!(calculate(data, Some("unknown")).is_err());
    }

    #[test]
    fn rejects_missing_invalid_and_inconsistent_counts() {
        for data in [
            json!({}),
            json!({"byCourse":[]}),
            json!({"byCourse":[course(48, 47, 0)]}),
            json!({"byCourse":[course(33, 47, 15)]}),
            json!({"byCourse":[{"courseId":"course-1"}]}),
        ] {
            assert!(calculate(data, None).is_err());
        }
    }
}
