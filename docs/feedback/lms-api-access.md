# Feedback transport on the campus LMS

Verified on 22 October 2026 with the configured test account on `lmsug24.iiitkottayam.ac.in`.

Moodle exposes feedback discovery, questions, access information, temporary and finished responses, launching an attempt, and processing pages through its official mobile web service. See [Moodle's feedback service definitions](https://github.com/moodle/moodle/blob/MOODLE_403_STABLE/mod/feedback/db/services.php).

Run `bun run test:feedback-api` to repeat the capability probe with locally configured credentials. It never prints session keys or tokens.

The campus deployment currently blocks those APIs:

- Cookie-authenticated `/lib/ajax/service.php` rejects all 14 probed feedback methods with `servicenotavailable`. These cover discovery, access, items, current/unfinished/finished responses, completion, analysis, viewing, launching and processing. Write methods were probed with required arguments omitted, so even an unexpectedly enabled method could not submit an answer.
- `/login/token.php` with the official `moodle_mobile_app` service rejects token issuance with `enablewsdescription`: web services must be enabled in Advanced features.
- The four courses reported as failed remain pending. Their activity pages and answer-form pages all returned HTTP 200 during the read-only diagnostic.

The historical submission 404 response bodies were not captured, so their cause is unconfirmed. A 404 alone does not establish rate limiting. The app submits courses sequentially and retries transient submission failures up to four total attempts, with 1.5, 3 and 6 second waits. Each attempt uses a newly loaded form; completion is checked after failed requests, and completed feedback is never replayed. Validation failures and unverified completion states stop automatic retries.

Until an LMS administrator enables and authorizes the official mobile service, use the authenticated form transport. Do not introduce guessed JSON endpoints or bypass Moodle permissions. If API access is enabled later, validate the supported methods with the current account before changing transports.

No additional course answers were submitted during the API or form diagnostics.
